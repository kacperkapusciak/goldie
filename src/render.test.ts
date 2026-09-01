import { describe, expect, test } from "bun:test";
import { createCanvas } from "@napi-rs/canvas";
import { wrapLines, wrapStyledLines } from "./render.ts";

const context = () => createCanvas(400, 200).getContext("2d");

describe("wrapStyledLines", () => {
  test("keeps the existing plain-text wrapping result", () => {
    const ctx = context();
    const font = "20px sans-serif";
    ctx.font = font;
    const width = ctx.measureText("One two").width + 0.1;

    expect(wrapStyledLines(ctx, "One two three", font, 0, width).map((line) => line.text)).toEqual([
      "One two",
      "three",
    ]);
    expect(wrapLines(ctx, "One two three", font, 0, width)).toEqual(["One two", "three"]);
  });

  test("carries an accent phrase across an automatic line wrap", () => {
    const ctx = context();
    const font = "20px sans-serif";
    ctx.font = font;
    const width = ctx.measureText("One two").width + 0.1;
    const lines = wrapStyledLines(ctx, "One two three", font, 0, width, "two three");
    const accented = lines.flatMap((line) =>
      line.emphasis ? [line.text.slice(line.emphasis.start, line.emphasis.end)] : [],
    );

    expect(accented).toEqual(["two", "three"]);
  });

  test("leaves unmatched phrases unstyled", () => {
    const lines = wrapStyledLines(
      context(),
      "One two three",
      "20px sans-serif",
      0,
      400,
      "not here",
    );

    expect(lines.every((line) => line.emphasis === null)).toBe(true);
  });
});
