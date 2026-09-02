import { exec, execOrThrow, parseJsonTail } from "./exec.ts";

/**
 * argent has no importable JS API - `@swmansion/argent` publishes only `bin`.
 * Everything here shells out to the CLI, which is the supported surface.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** Prefer the pinned dependency over whatever happens to be on PATH. */
function resolveBin(): string {
  if (process.env.GOLDIE_ARGENT_BIN) return process.env.GOLDIE_ARGENT_BIN;
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@swmansion/argent/package.json");
    const pkg = require(pkgPath) as { bin?: Record<string, string> };
    if (pkg.bin?.argent) return join(dirname(pkgPath), pkg.bin.argent);
  } catch {
    /* not installed next to goldie; fall back to PATH */
  }
  // npm installs a `.cmd` shim on Windows; spawn finds it only by full name.
  return process.platform === "win32" ? "argent.cmd" : "argent";
}

const BIN = resolveBin();

/**
 * The pinned bin is a JS entry point. A shebang makes it directly spawnable on
 * macOS and Linux, but Windows has no shebang support, so run it through the
 * node that runs goldie. This also skips the PATH lookup everywhere.
 */
const RUNNER: [string, string[]] = /\.[cm]?js$/.test(BIN) ? [process.execPath, [BIN]] : [BIN, []];

function argent(args: string[], opts: { quiet?: boolean } = {}) {
  return exec(RUNNER[0], [...RUNNER[1], ...args], opts);
}

function argentOrThrow(args: string[], opts: { quiet?: boolean } = {}) {
  return execOrThrow(RUNNER[0], [...RUNNER[1], ...args], opts);
}

type Primitive = string | number | boolean;

function flags(args: Record<string, Primitive | undefined>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    out.push(`--${k}`, String(v));
  }
  return out;
}

/** Invoke a tool and return its parsed `data`. */
export async function run<T = any>(
  tool: string,
  args: Record<string, Primitive | undefined>,
): Promise<T> {
  const r = await argentOrThrow(["run", tool, "--json", ...flags(args)]);
  const parsed = parseJsonTail<any>(r.stdout);
  return (parsed?.data ?? parsed) as T;
}

/** Invoke a tool that returns an image/video artifact, writing it to `out`. */
export async function runToFile(
  tool: string,
  args: Record<string, Primitive | undefined>,
  out: string,
): Promise<string> {
  await argentOrThrow(["run", tool, "--out", out, ...flags(args)]);
  return out;
}

/** Mirrors argent's StepReport (packages/tool-server/src/tools/flows/flow-run.ts). */
export type FlowStepReport = {
  index?: number;
  kind?: string;
  status?: string;
  /** Machine-readable explanation; always set when the step did not pass. */
  reason?: string;
  warning?: string;
  tool?: string;
  /** Display-only "what this step acts on" - the selector, the snapshot name. */
  target?: string;
  message?: string;
  error?: string;
  [k: string]: unknown;
};

export type FlowReport = {
  ok: boolean;
  raw: unknown;
  steps: FlowStepReport[];
  failed: FlowStepReport | null;
  stdout: string;
};

/** Replay a flow YAML headlessly. Never throws - inspect `ok` / `failed`. */
export async function flow(pathOrName: string, udid: string): Promise<FlowReport> {
  const r = await argent(["flow", "run", pathOrName, "--device", udid, "--json"], { quiet: true });
  const raw = parseJsonTail<any>(r.stdout);
  const steps: FlowStepReport[] = raw?.steps ?? raw?.report?.steps ?? [];
  const failed = steps.find((s) => s.status === "fail" || s.status === "error") ?? null;
  return { ok: r.code === 0, raw, steps, failed, stdout: r.stdout + r.stderr };
}

/** Is the argent corner watermark disabled? Previews must not carry it. */
export async function watermarkDisabled(): Promise<boolean> {
  const r = await argent(["flags"], { quiet: true });
  const line = r.stdout.split("\n").find((l) => l.includes("video-watermark"));
  return Boolean(line && /disabled/.test(line));
}

/**
 * Stop the shared tool-server so the next call auto-spawns a fresh one.
 * Needed after a simulator shutdown: the running server keeps a transport
 * session pointed at the device that went away, and every later `launch`
 * then fails its native-devtools handshake.
 */
export async function restartServer(): Promise<void> {
  await argent(["server", "stop"], { quiet: true });
  await new Promise((r) => setTimeout(r, 1500));
}

export async function available(): Promise<boolean> {
  const r = await argent(["--version"], { quiet: true });
  return r.code === 0;
}
