import { open } from "node:fs/promises";

export type PngInfo = { width: number; height: number; hasAlpha: boolean };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Reads a PNG's dimensions and whether it carries transparency from its
 * chunk headers. Replaces `sips`, which exists only on macOS. Alpha is either
 * a colour type with an alpha channel (grayscale+alpha, RGBA) or a tRNS chunk
 * ahead of the pixel data, which is what image tools report as "hasAlpha".
 */
export async function pngInfo(file: string): Promise<PngInfo> {
  const fh = await open(file, "r");
  try {
    const head = Buffer.alloc(33);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    if (bytesRead < head.length || !head.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error(`${file} is not a PNG`);
    }
    if (head.toString("latin1", 12, 16) !== "IHDR") throw new Error(`${file}: missing IHDR`);
    const width = head.readUInt32BE(16);
    const height = head.readUInt32BE(20);
    const colorType = head[25]!;
    let hasAlpha = colorType === 4 || colorType === 6;

    // Walk the chunks before IDAT looking for tRNS.
    let offset = 33;
    const chunkHead = Buffer.alloc(8);
    while (!hasAlpha) {
      const r = await fh.read(chunkHead, 0, 8, offset);
      if (r.bytesRead < 8) break;
      const length = chunkHead.readUInt32BE(0);
      const type = chunkHead.toString("latin1", 4, 8);
      if (type === "tRNS") hasAlpha = true;
      if (type === "IDAT" || type === "IEND") break;
      offset += 12 + length;
    }
    return { width, height, hasAlpha };
  } finally {
    await fh.close();
  }
}

export async function imageSize(file: string): Promise<{ width: number; height: number }> {
  const { width, height } = await pngInfo(file);
  return { width, height };
}
