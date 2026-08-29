/** Mirrors the StoreManifest that `goldie manifest` writes to out/store.json. */

export type Theme = {
  background: string;
  headlineColor: string;
  subheadColor: string;
  fontFamily: string;
  /** Fraction of the frame height reserved for copy above the device. */
  copyHeightRatio: number;
  /** Fraction of the frame width the device bezel occupies. */
  deviceWidthRatio: number;
};

/** Mirrors Decoration in src/config.ts; image `src` values are urls under out/web. */
export type Decoration =
  | {
      kind: "badge";
      text: Record<string, string>;
      position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
      background?: string;
      color?: string;
    }
  | { kind: "image"; src: string; x: number; y: number; width: number; rotate?: number };

export type LayoutEntry = { key: string; label: string; description: string; span: number };
export type TemplateEntry = { key: string; label: string; description: string; sequence: string[] };

/** null simulatorName / preview mark an android device; the strip fully renders only iOS today (multi-device UI is PR #1). */
export type DeviceEntry = {
  key: string;
  label: string;
  simulatorName: string | null;
  screenshot: { width: number; height: number };
  preview: { width: number; height: number } | null;
};

export type DesignScene = {
  id: string;
  headline: Record<string, string>;
  subhead?: Record<string, string>;
  layout?: string;
  secondScene?: string;
  decorations?: Decoration[];
};

export type BundledFont = {
  key: string;
  family: string;
  fallback: string;
  faces: Array<{ weight: number; url: string }>;
};

export type DeviceCaptures = {
  screenshots: Array<{ sceneId: string; url: string }>;
  clips: Array<{ segmentId: string; url: string; durationSeconds: number }> | null;
};

export type Design = {
  theme: Theme;
  /** null when the config points at custom bezel art. */
  frameVariant: string | null;
  frameVariants: string[];
  customFrameUrl: string | null;
  /** Bundled typefaces with the @font-face sources to declare. */
  fonts: BundledFont[];
  layouts: LayoutEntry[];
  templates: TemplateEntry[];
  /** The theme's template: a built-in key, null for none, or the config's custom sequence. */
  template: string | string[] | null;
  /** The theme's default layout key. */
  layout: string;
  screenOnly: boolean;
  decorations: Decoration[];
  scenes: DesignScene[];
  preview: {
    sceneId: string;
    segments: Array<{ id: string }>;
  } | null;
  /** Raw capture urls per device key; a device is absent until `goldie capture` ran. */
  captures: Record<string, DeviceCaptures>;
};

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
  devices: DeviceEntry[];
  locales: string[];
  design: Design;
};

export async function loadManifest(): Promise<StoreManifest> {
  const res = await fetch("/store.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      "No out/store.json. Generate the assets first:  goldie all  (or  goldie manifest)",
    );
  }
  const manifest: StoreManifest = await res.json();
  if (!manifest.design?.fonts || !manifest.design.layouts) {
    throw new Error("out/store.json predates browser-side composition. Re-run: goldie manifest");
  }

  // Raw captures keep their names across a re-capture, so the manifest's
  // timestamp becomes a cache-buster - a capture followed by a manifest
  // reload shows new pixels.
  const v = `?v=${Date.parse(manifest.generatedAt) || 0}`;
  for (const captures of Object.values(manifest.design.captures)) {
    for (const shot of captures.screenshots) shot.url += v;
    for (const clip of captures.clips ?? []) clip.url += v;
  }
  return manifest;
}

/** The design choices saved on disk next to the config; see src/studio-server.ts. */
export type SavedDesign = {
  background?: string;
  frame?: string;
  fontFamily?: string;
  /** Copy edited in the lightbox, per screenshot scene id, then locale. */
  copy?: Record<string, SceneCopy>;
  /** Screenshot scene ids in the order the tiles were dragged into. */
  order?: string[];
  /** A built-in template key, or "" for none. */
  template?: string;
  /** Default layout key for scenes the template does not cover. */
  layout?: string;
  screenOnly?: boolean;
  /** Layout overrides per screenshot scene id. */
  sceneLayouts?: Record<string, string>;
};

export type SceneCopy = {
  headline?: Record<string, string>;
  subhead?: Record<string, string>;
};

export async function loadDesign(): Promise<SavedDesign> {
  try {
    const res = await fetch("/api/design", { cache: "no-store" });
    if (!res.ok) return {};
    const parsed = await res.json();
    return parsed && typeof parsed === "object" ? (parsed as SavedDesign) : {};
  } catch {
    return {}; // a static build has no API; the config's values stand
  }
}

export async function saveDesign(design: SavedDesign): Promise<void> {
  const res = await fetch("/api/design", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(design),
  });
  if (!res.ok) throw new Error(`Saving goldie.design.json failed: ${await res.text()}`);
}
