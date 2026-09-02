import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";

/**
 * Typefaces bundled in assets/fonts/ (Google Fonts, OFL). Each one ships a
 * regular and a bold cut; the renderer registers them with the canvas and
 * the studio declares matching @font-face rules, so a bundled font looks
 * the same in the browser and in the exported PNGs. `theme.fontFamily` stays
 * a plain CSS string: system fonts keep working, and `fontStack()` builds the
 * value for a bundled one.
 */
export type BundledFont = {
  /** CSS family name, as registered with the canvas and declared in @font-face. */
  family: string;
  /** Generic fallbacks appended after the family. */
  fallback: string;
  /** Font files under assets/fonts/, keyed by weight. */
  files: Record<number, string>;
};

export const FONTS = {
  merriweather: {
    family: "Merriweather",
    fallback: "Georgia, serif",
    files: { 400: "Merriweather-400.ttf", 700: "Merriweather-700.ttf" },
  },
  "dm-mono": {
    family: "DM Mono",
    fallback: "ui-monospace, Menlo, monospace",
    // DM Mono ships no bold; its heaviest cut is 500.
    files: { 400: "DMMono-400.ttf", 500: "DMMono-500.ttf" },
  },
  lato: {
    family: "Lato",
    fallback: "system-ui, sans-serif",
    files: { 400: "Lato-400.ttf", 700: "Lato-700.ttf" },
  },
  "dm-sans": {
    family: "DM Sans",
    fallback: "system-ui, sans-serif",
    files: { 400: "DMSans-400.ttf", 700: "DMSans-700.ttf" },
  },
  montserrat: {
    family: "Montserrat",
    fallback: "system-ui, sans-serif",
    files: { 400: "Montserrat-400.ttf", 700: "Montserrat-700.ttf" },
  },
  "noto-sans-sc": {
    family: "Noto Sans SC",
    fallback: '"PingFang SC", "Microsoft YaHei", sans-serif',
    files: { 400: "NotoSansSC-400.otf", 700: "NotoSansSC-700.otf" },
  },
} as const satisfies Record<string, BundledFont>;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/** The system font: what the example config uses and what `--font system` restores. */
export const SYSTEM_FONT = '-apple-system, "SF Pro Display", system-ui, sans-serif';

const FONTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");

export function fontFilePath(file: string): string {
  return resolve(FONTS_DIR, file);
}

/** The `theme.fontFamily` value for a bundled font, or the system stack for "system". */
export function fontStack(key: string): string {
  if (key === "system") return SYSTEM_FONT;
  const font = (FONTS as Record<string, BundledFont>)[key];
  if (!font) {
    throw new Error(`Unknown font "${key}". Available: system, ${FONT_KEYS.join(", ")}`);
  }
  return `"${font.family}", ${font.fallback}`;
}

/**
 * The canvas resolves glyphs only against families it knows; unlike a browser
 * it never falls back to other system fonts, so CJK copy over a latin-only
 * stack exports as tofu boxes. Appending the bundled CJK typeface as a last
 * resort fixes that: skia falls through per glyph, so latin text keeps its
 * chosen face and only characters the stack cannot draw reach the fallback.
 */
export function withGlyphFallback(stack: string): string {
  const cjk = FONTS["noto-sans-sc"].family;
  return stack.includes(cjk) ? stack : `${stack}, "${cjk}"`;
}

let registered = false;

/** Makes every bundled font available to the canvas. Safe to call repeatedly. */
export function registerFonts() {
  if (registered) return;
  registered = true;
  for (const font of Object.values(FONTS)) {
    for (const file of Object.values(font.files)) {
      GlobalFonts.registerFromPath(fontFilePath(file), font.family);
    }
  }
}
