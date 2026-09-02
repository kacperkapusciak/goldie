import { spawn } from "node:child_process";

export type ExecResult = { code: number; stdout: string; stderr: string };

export function exec(
  cmd: string,
  args: string[],
  opts: { cwd?: string; quiet?: boolean } = {},
): Promise<ExecResult> {
  return new Promise((res) => {
    // Node refuses to spawn .cmd/.bat shims without a shell; with one, it does
    // not quote arguments, so paths with spaces must be quoted here.
    const shell = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
    const argv = shell ? args.map(quoteForCmd) : args;
    const child = spawn(cmd, argv, { cwd: opts.cwd, shell, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      if (!opts.quiet) process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (!opts.quiet) process.stderr.write(d);
    });
    // A missing binary surfaces as an 'error' event, not a non-zero exit.
    child.on("error", (err) => res({ code: 127, stdout, stderr: stderr + String(err) }));
    child.on("close", (code) => res({ code: code ?? 1, stdout, stderr }));
  });
}

function quoteForCmd(arg: string): string {
  return /[\s"&|<>^()]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export async function execOrThrow(
  cmd: string,
  args: string[],
  opts: { cwd?: string; quiet?: boolean } = {},
) {
  const r = await exec(cmd, args, { quiet: true, ...opts });
  if (r.code !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${r.code}\n${r.stderr || r.stdout}`);
  }
  return r;
}

/** First JSON value in a stream that may be prefixed with human-readable log lines. */
export function parseJsonTail<T = unknown>(out: string): T | null {
  const start = out.search(/[[{]/);
  if (start === -1) return null;
  for (let end = out.length; end > start; end--) {
    try {
      return JSON.parse(out.slice(start, end)) as T;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}
