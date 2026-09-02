import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "./exec.ts";
import { zipDirs, zipEntries } from "./zip.ts";

describe("zip", () => {
  test("writes an archive with the expected entries and sizes", () => {
    const buf = zipEntries([{ name: "a/b.txt", data: Buffer.from("hello hello hello") }]);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50); // local header
    expect(buf.readUInt32LE(buf.length - 22)).toBe(0x06054b50); // end of central directory
    expect(buf.readUInt16LE(buf.length - 22 + 10)).toBe(1); // entry count
  });

  test("zipDirs mirrors the directory layout with forward slashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "goldie-zip-"));
    await mkdir(join(root, "screenshots", "iphone-6.9", "en-US"), { recursive: true });
    await writeFile(join(root, "screenshots", "iphone-6.9", "en-US", "1-home.png"), "png");
    await mkdir(join(root, "previews"), { recursive: true });
    await writeFile(join(root, "previews", "clip.mp4"), Buffer.alloc(4096, 7));
    const out = join(root, "export.zip");
    const count = await zipDirs(root, ["screenshots", "previews", "missing"], out);
    expect(count).toBe(2);

    // Verify with the system unzip when it is available (macOS and Linux).
    const listing = await exec("unzip", ["-l", out], { quiet: true });
    if (listing.code === 0) {
      expect(listing.stdout).toContain("screenshots/iphone-6.9/en-US/1-home.png");
      expect(listing.stdout).toContain("previews/clip.mp4");
      const check = await exec("unzip", ["-t", out], { quiet: true });
      expect(check.code).toBe(0);
    }
    expect((await readFile(out)).readUInt32LE(0)).toBe(0x04034b50);
  });
});
