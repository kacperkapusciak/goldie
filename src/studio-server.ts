import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "./exec.ts";
import { zipDirs } from "./zip.ts";

/**
 * The studio's HTTP surface, shared by `goldie studio` (a static server over
 * the prebuilt studio/dist) and the Vite dev server (studio/vite.config.ts).
 *
 * GET/PUT /api/design - the design choices saved next to the config as
 * goldie.design.json ({ background?, frames?, fontFamily?, copy?, order? }).
 * The CLI's loadConfig() applies the file, so a saved choice also shapes plain
 * `goldie frame` runs. The UI debounces its PUTs; the server writes the file
 * atomically so a half-written JSON never reaches the CLI.
 *
 * POST /api/export - renders the final assets from the raw captures with the
 * chosen background and frame (goldie frame + preview + manifest), zips
 * out/screenshots and out/previews, and streams the CLI log as plain text.
 * Body: { background?, frames?, font?, template?, layout?, screenOnly? };
 * per-scene layouts ride on goldie.design.json, which the CLI reads on its
 * own. The response ends with "[done]" on success or "[failed]" otherwise; on
 * "[done]" the UI downloads GET /api/export/download.
 */

export type StudioPaths = {
  configPath: string;
  configDir: string;
  outDir: string;
  webDir: string;
  designFile: string;
  exportZip: string;
};

/** Every path the studio touches derives from the config file's location. */
export function studioPaths(configPath: string): StudioPaths {
  const configDir = dirname(resolve(configPath));
  const outDir = join(configDir, "out");
  return {
    configPath: resolve(configPath),
    configDir,
    outDir,
    webDir: join(outDir, "web"),
    designFile: join(configDir, "goldie.design.json"), // mirrors designPath() in config.ts
    exportZip: join(outDir, "export.zip"),
  };
}

export type ExportOptions = {
  background?: string;
  /** One bezel variant per device key. */
  frames?: Record<string, string>;
  font?: string;
  template?: string;
  layout?: string;
  screenOnly?: boolean;
};

export type StudioApi = {
  paths: StudioPaths;
  /** Command prefix that runs the goldie CLI, e.g. ["node", ".../dist/cli.js"]. */
  cli: string[];
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => done(body));
  });
}

/** Handles /api/design. */
export function designHandler({ paths }: StudioApi): Handler {
  return (req, res) => {
    if (req.method === "GET") {
      readFile(paths.designFile, "utf8").then(
        (json) => {
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end(json);
        },
        () => {
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end("{}");
        },
      );
      return;
    }
    if (req.method !== "PUT") {
      res.statusCode = 405;
      res.end("GET or PUT only");
      return;
    }
    readBody(req).then(async (body) => {
      let design: Record<string, unknown>;
      try {
        design = JSON.parse(body);
        if (!design || typeof design !== "object") throw new Error();
      } catch {
        res.statusCode = 400;
        res.end("Body must be a JSON object.");
        return;
      }
      try {
        const tmp = `${paths.designFile}.tmp`;
        await writeFile(tmp, `${JSON.stringify(design, null, 2)}\n`);
        await rename(tmp, paths.designFile);
        res.statusCode = 204;
        res.end();
      } catch (err) {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : String(err));
      }
    });
  };
}

/** Handles /api/export and /api/export/download. `sub` is the path after /api/export. */
export function exportHandler({ paths, cli }: StudioApi): (sub: string) => Handler {
  let busy = false;

  return (sub) => (req, res) => {
    if (req.method === "GET" && sub === "/download") {
      if (!existsSync(paths.exportZip)) {
        res.statusCode = 404;
        res.end("No export yet. POST /api/export first.");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Length": statSync(paths.exportZip).size,
        "Content-Disposition": 'attachment; filename="appstore-assets.zip"',
        "Cache-Control": "no-store",
      });
      createReadStream(paths.exportZip).pipe(res);
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("POST only");
      return;
    }
    if (busy) {
      res.statusCode = 409;
      res.end("An export is already running.");
      return;
    }
    busy = true;

    readBody(req).then(async (body) => {
      let opts: ExportOptions;
      try {
        opts = JSON.parse(body || "{}");
      } catch {
        busy = false;
        res.statusCode = 400;
        res.end("Body must be JSON.");
        return;
      }

      const flags: string[] = [];
      if (opts.background) flags.push("--background", opts.background);
      for (const variant of Object.values(opts.frames ?? {})) {
        if (variant) flags.push("--frame", variant);
      }
      if (opts.font) flags.push("--font", opts.font);
      if (opts.template) flags.push("--template", opts.template);
      if (opts.layout) flags.push("--layout", opts.layout);
      if (opts.screenOnly) flags.push("--screen-only");

      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });

      const [bin, ...prefix] = cli;
      try {
        for (const command of ["frame", "preview", "manifest"]) {
          res.write(`$ goldie ${command}\n`);
          await stream(bin!, [...prefix, command, ...flags], paths.configDir, res, {
            GOLDIE_CONFIG: paths.configPath,
          });
        }
        res.write("$ zip screenshots + previews\n");
        await rm(paths.exportZip, { force: true });
        const count = await zipDirs(paths.outDir, ["screenshots", "previews"], paths.exportZip);
        res.write(`  ${count} files\n`);
        res.write("[done]\n");
      } catch (err) {
        res.write(`[failed] ${err instanceof Error ? err.message : err}\n`);
      } finally {
        busy = false;
        res.end();
      }
    });
  };
}

function stream(
  cmd: string,
  args: string[],
  cwd: string,
  res: ServerResponse,
  env: Record<string, string> = {},
): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    child.stdout.on("data", (d) => res.write(d));
    child.stderr.on("data", (d) => res.write(d));
    child.on("error", fail);
    child.on("close", (code) => (code === 0 ? done() : fail(new Error(`exit code ${code}`))));
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** Serve `file` with Range support, so the preview video seeks in the browser. */
function sendFile(req: IncomingMessage, res: ServerResponse, file: string) {
  const size = statSync(file).size;
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
}

/** Resolve a URL path inside `root`, or null when it escapes or is missing. */
function fileIn(root: string, urlPath: string): string | null {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, rel);
  if (!file.startsWith(root)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

/** The studio bundle Vite emits; shipped in the npm package. */
export const STUDIO_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "studio", "dist");

/**
 * Serve the prebuilt studio plus the app's out/web at `/`, with the API on top.
 * Resolves with the URL once listening.
 */
export function serveStudio(api: StudioApi, port = 4321): Promise<string> {
  if (!existsSync(join(STUDIO_DIST, "index.html"))) {
    throw new Error(
      `No studio build at ${STUDIO_DIST}. In a source checkout run: bun run studio:build`,
    );
  }
  const design = designHandler(api);
  const exp = exportHandler(api);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    if (path === "/api/design") return design(req, res);
    if (path.startsWith("/api/export")) return exp(path.slice("/api/export".length))(req, res);

    const file = fileIn(api.paths.webDir, path) ?? fileIn(STUDIO_DIST, path);
    if (file) return sendFile(req, res, file);
    if (path === "/store.json") {
      res.statusCode = 404;
      res.end("No out/web/store.json. Run: goldie manifest");
      return;
    }
    sendFile(req, res, join(STUDIO_DIST, "index.html"));
  });

  return new Promise((done, fail) => {
    server.on("error", fail);
    server.listen(port, "127.0.0.1", () => done(`http://localhost:${port}`));
  });
}

/** Open a URL in the default browser; best effort. */
export async function openInBrowser(url: string): Promise<void> {
  // `start` is a cmd.exe builtin, not a program; the empty string is its window title.
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", '""', url]]
        : ["xdg-open", [url]];
  await exec(cmd, args, { quiet: true });
}
