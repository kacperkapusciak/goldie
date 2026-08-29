import { copyFile, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { CaptureManifest } from "./capture.ts";
import {
  type Decoration,
  FRAME_VARIANTS,
  framePath,
  isPreview,
  isScreenshot,
  type LoadedConfig,
  type Theme,
  variantFramePath,
} from "./config.ts";
import { execOrThrow } from "./exec.ts";
import { FONTS, fontFilePath } from "./fonts.ts";
import { LAYOUTS, TEMPLATES } from "./layouts.ts";
import { DEVICES, type DeviceKey } from "./specs.ts";

/**
 * `out/web/` - the studio's static root. It holds the manifest, the
 * bezel art, and symlinks to the finished assets and the raw
 * captures. The raw captures and bezels are what the studio composites in
 * the browser (instant background/frame changes); the finished files under
 * screenshots/ and previews/ are what an export zips up.
 *
 * The `design` section carries everything the browser-side composition needs:
 * the theme, each scene's copy, and per-device raw capture urls. `assets`
 * still records the finished files so tooling can see what was last rendered.
 */
export type StoreManifest = {
  generatedAt: string;
  app: {
    name: string;
    subtitle: Record<string, string>;
    developer: string;
    category: string;
    rating: number;
    ratingCount: string;
    ageRating: string;
    price: string;
    description: Record<string, string>;
  };
  /**
   * null simulatorName / preview mark an android device. The studio's strip
   * view only fully renders iOS devices today; multi-device UI is upstream
   * (goldie PR #1).
   */
  devices: Array<{
    key: DeviceKey;
    label: string;
    simulatorName: string | null;
    screenshot: { width: number; height: number };
    preview: { width: number; height: number } | null;
  }>;
  locales: string[];
  /** Keyed by device key, then locale. */
  assets: Record<string, Record<string, LocaleAssets>>;
  /** Everything the studio needs to composite scenes in the browser. */
  design: {
    theme: Theme;
    /** null when the config points at custom bezel art. */
    frameVariant: string | null;
    frameVariants: string[];
    /** Url of the config's custom bezel art; null when a bundled variant is used. */
    customFrameUrl: string | null;
    /** Bundled typefaces, with the @font-face sources the studio declares. */
    fonts: Array<{
      key: string;
      family: string;
      fallback: string;
      faces: Array<{ weight: number; url: string }>;
    }>;
    /** Every layout the studio can pick, in menu order. */
    layouts: Array<{ key: string; label: string; description: string; span: number }>;
    templates: Array<{ key: string; label: string; description: string; sequence: string[] }>;
    /** The theme's template: a built-in key, null for none, or the config's custom sequence. */
    template: string | string[] | null;
    /** The theme's default layout key. */
    layout: string;
    screenOnly: boolean;
    /** Theme-level decorations; image `src` values are urls under out/web. */
    decorations: Decoration[];
    scenes: Array<{
      id: string;
      headline: Record<string, string>;
      subhead?: Record<string, string>;
      layout?: string;
      secondScene?: string;
      decorations?: Decoration[];
    }>;
    preview: {
      sceneId: string;
      segments: Array<{ id: string }>;
    } | null;
    /** Raw capture urls per device key; a device is absent until `goldie capture` ran. */
    captures: Record<
      string,
      {
        screenshots: Array<{ sceneId: string; url: string }>;
        clips: Array<{ segmentId: string; url: string; durationSeconds: number }> | null;
      }
    >;
  };
};

export type LocaleAssets = {
  screenshots: Array<{
    sceneId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
  }>;
  preview: {
    sceneId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    durationSeconds: number;
  } | null;
};

export const WEB_DIR = "web";

export async function writeManifest(cfg: LoadedConfig): Promise<string> {
  const webDir = join(cfg.outDir, WEB_DIR);
  await mkdir(webDir, { recursive: true });
  await link(join(cfg.outDir, "screenshots"), join(webDir, "screenshots"));
  await link(join(cfg.outDir, "previews"), join(webDir, "previews"));
  await link(join(cfg.outDir, "raw"), join(webDir, "raw"));

  // Bezel art the browser composites with; every bundled variant so switching
  // frames never waits on a server.
  const framesDir = join(webDir, "frames");
  await mkdir(framesDir, { recursive: true });
  for (const variant of FRAME_VARIANTS) {
    await copyFile(variantFramePath(variant), join(framesDir, `${variant}.png`));
  }
  const custom = "variant" in cfg.frame ? null : "frames/custom.png";
  if (custom) await copyFile(framePath(cfg), join(webDir, custom));

  // Bundled typefaces, so the browser renders the same cuts the canvas does.
  const fontsDir = join(webDir, "fonts");
  await mkdir(fontsDir, { recursive: true });
  const fonts: StoreManifest["design"]["fonts"] = [];
  for (const [key, font] of Object.entries(FONTS)) {
    const faces: Array<{ weight: number; url: string }> = [];
    for (const [weight, file] of Object.entries(font.files)) {
      await copyFile(fontFilePath(file), join(fontsDir, file));
      faces.push({ weight: Number(weight), url: `fonts/${file}` });
    }
    fonts.push({ key, family: font.family, fallback: font.fallback, faces });
  }

  // Decoration images, copied so the browser can draw the same layers.
  const decorDir = join(webDir, "decor");
  await mkdir(decorDir, { recursive: true });
  const webDecorations = async (list: Decoration[] | undefined) =>
    Promise.all(
      (list ?? []).map(async (d) => {
        if (d.kind !== "image") return d;
        const name = basename(d.src);
        await copyFile(resolve(cfg.root, d.src), join(decorDir, name));
        return { ...d, src: `decor/${name}` };
      }),
    );
  const scenes: StoreManifest["design"]["scenes"] = [];
  for (const scene of cfg.scenes.filter(isScreenshot)) {
    scenes.push({
      id: scene.id,
      headline: scene.headline,
      ...(scene.subhead ? { subhead: scene.subhead } : {}),
      ...(scene.layout ? { layout: scene.layout } : {}),
      ...(scene.secondScene ? { secondScene: scene.secondScene } : {}),
      ...(scene.decorations ? { decorations: await webDecorations(scene.decorations) } : {}),
    });
  }

  const assets: StoreManifest["assets"] = {};
  for (const deviceKey of cfg.devices) {
    assets[deviceKey] = {};
    for (const locale of cfg.locales) {
      assets[deviceKey][locale] = await collect(cfg, deviceKey, locale);
    }
  }

  const captures: StoreManifest["design"]["captures"] = {};
  for (const deviceKey of cfg.devices) {
    const raw = await readCaptureManifest(cfg, deviceKey);
    if (!raw) continue;
    captures[deviceKey] = {
      screenshots: raw.screenshots.map((s) => ({
        sceneId: s.sceneId,
        url: `raw/${deviceKey}/${basename(s.file)}`,
      })),
      clips: raw.preview
        ? raw.preview.clips.map((c) => ({
            segmentId: c.segmentId,
            url: `raw/${deviceKey}/${basename(c.file)}`,
            durationSeconds: c.durationSeconds,
          }))
        : null,
    };
  }

  const previewScene = cfg.scenes.find(isPreview);
  const manifest: StoreManifest = {
    generatedAt: new Date().toISOString(),
    app: { ...cfg.store },
    devices: cfg.devices.map((key) => ({
      key,
      label: DEVICES[key].label,
      simulatorName: DEVICES[key].simulatorName ?? null,
      screenshot: DEVICES[key].screenshot,
      preview: DEVICES[key].preview,
    })),
    locales: cfg.locales,
    assets,
    design: {
      theme: cfg.theme,
      frameVariant: "variant" in cfg.frame ? cfg.frame.variant : null,
      frameVariants: [...FRAME_VARIANTS],
      customFrameUrl: custom,
      fonts,
      layouts: Object.values(LAYOUTS).map(({ key, label, description, span }) => ({
        key,
        label,
        description,
        span,
      })),
      templates: Object.values(TEMPLATES),
      template: cfg.theme.template ?? null,
      layout: cfg.theme.layout ?? "classic",
      screenOnly: cfg.theme.screenOnly ?? false,
      decorations: await webDecorations(cfg.theme.decorations),
      scenes,
      preview: previewScene
        ? {
            sceneId: previewScene.id,
            segments: previewScene.segments.map(({ id }) => ({ id })),
          }
        : null,
      captures,
    },
  };

  const file = join(webDir, "store.json");
  await writeFile(file, JSON.stringify(manifest, null, 2));
  return file;
}

async function readCaptureManifest(
  cfg: LoadedConfig,
  deviceKey: DeviceKey,
): Promise<CaptureManifest | null> {
  try {
    return JSON.parse(await readFile(join(cfg.outDir, "raw", deviceKey, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

async function collect(
  cfg: LoadedConfig,
  deviceKey: DeviceKey,
  locale: string,
): Promise<LocaleAssets> {
  const label = DEVICES[deviceKey].label;
  const shotDir = join(cfg.outDir, "screenshots", label, locale);
  const previewDir = join(cfg.outDir, "previews", label, locale);
  const sceneOrder = cfg.scenes.filter(isScreenshot).map((s) => s.id);

  const screenshots: LocaleAssets["screenshots"] = [];
  for (const name of (await ls(shotDir)).filter((f) => f.endsWith(".png")).sort()) {
    const file = join(shotDir, name);
    const { width, height } = await imageSize(file);
    // Files are named "<index>-<sceneId>.png".
    const sceneId = sceneOrder.find((id) => name.includes(id)) ?? basename(name, ".png");
    screenshots.push({
      sceneId,
      url: `screenshots/${label}/${locale}/${name}`,
      width,
      height,
      bytes: (await stat(file)).size,
    });
  }

  const previewScene = cfg.scenes.find(isPreview);
  const previewName = (await ls(previewDir)).find((f) => f.endsWith(".mp4"));
  let preview: LocaleAssets["preview"] = null;
  if (previewScene && previewName) {
    const file = join(previewDir, previewName);
    const probe = await videoInfo(file);
    preview = {
      sceneId: previewScene.id,
      url: `previews/${label}/${locale}/${previewName}`,
      ...probe,
      bytes: (await stat(file)).size,
    };
  }

  return { screenshots, preview };
}

const ls = async (dir: string) => readdir(dir).catch(() => [] as string[]);

/** Relative symlink, replaced on every run so a moved out/ never goes stale. */
async function link(target: string, path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
  await symlink(relative(dirname(path), target), path, "dir");
}

async function imageSize(file: string) {
  const r = await execOrThrow("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  return {
    width: Number(r.stdout.match(/pixelWidth:\s*(\d+)/)?.[1]),
    height: Number(r.stdout.match(/pixelHeight:\s*(\d+)/)?.[1]),
  };
}

async function videoInfo(file: string) {
  const r = await execOrThrow("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const probe = JSON.parse(r.stdout);
  return {
    width: probe.streams[0].width as number,
    height: probe.streams[0].height as number,
    durationSeconds: Number(probe.format.duration),
  };
}
