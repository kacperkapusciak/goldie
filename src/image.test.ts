import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { pngInfo } from "./image.ts";

async function png(width: number, height: number): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "goldie-png-"));
  const file = join(dir, `${width}x${height}.png`);
  await writeFile(file, await createCanvas(width, height).encode("png"));
  return file;
}

describe("pngInfo", () => {
  test("reads dimensions from the IHDR chunk", async () => {
    const info = await pngInfo(await png(1320, 2868));
    expect(info.width).toBe(1320);
    expect(info.height).toBe(2868);
  });

  test("reports the canvas's RGBA encoding as alpha", async () => {
    expect((await pngInfo(await png(4, 3))).hasAlpha).toBe(true);
  });

  test("reports an opaque truecolour PNG as alpha-free", async () => {
    // Hand-built 1x1 RGB PNG (colour type 2, no tRNS).
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
      "base64",
    );
    const dir = await mkdtemp(join(tmpdir(), "goldie-png-"));
    const file = join(dir, "rgb.png");
    await writeFile(file, bytes);
    const info = await pngInfo(file);
    expect(info).toEqual({ width: 1, height: 1, hasAlpha: false });
  });

  test("rejects a file that is not a PNG", async () => {
    const dir = await mkdtemp(join(tmpdir(), "goldie-png-"));
    const file = join(dir, "text.png");
    await writeFile(file, "not a png at all, just some text bytes");
    await expect(pngInfo(file)).rejects.toThrow("not a PNG");
  });
});
