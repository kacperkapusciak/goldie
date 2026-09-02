/**
 * The screenshot layouts (templates) and the one function that turns a layout
 * into pixel geometry. Pure, with no node imports: the CLI renderer
 * (src/render.ts) and the studio (studio/src/components/Strip.tsx) both call
 * compose() with the same inputs, which is what keeps the browser preview and
 * the exported PNG identical. Every number that shapes a composition lives
 * here; neither renderer carries geometry or type sizes of its own.
 */
import { FRAME, type FrameGeometry } from "./frame.ts";

export const LAYOUT_KEYS = [
  "classic",
  "copy-below",
  "hero",
  "offset",
  "tilt",
  "tilt-right",
  "duo",
  "duo-tilt",
  "panorama",
  "panorama-duo",
  "minimal",
] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export type CopyAlign = "center" | "left";
export type CopyPosition = "top" | "bottom" | "none";

export type LayoutSpec = {
  key: LayoutKey;
  label: string;
  description: string;
  /** Store tiles this composition covers; a panorama is sliced into `span` PNGs. */
  span: 1 | 2;
  copy: {
    position: CopyPosition;
    align: CopyAlign;
    /**
     * Fraction of the tile height the copy block takes. `classic` reads
     * theme.copyHeightRatio instead so existing configs keep their look.
     */
    heightRatio?: number;
    /** Anchor x as a fraction of the composition width; the default centres it (or sits at padX when left aligned). */
    x?: number;
    /** Wrap width as a fraction of the tile width; the default leaves padX on both sides. */
    widthRatio?: number;
  };
  /** Back to front. One device, or two for the duo layouts (the second reads `secondScene`). */
  devices: DevicePlacement[];
};

export type DevicePlacement = {
  /** Bezel width as a fraction of the tile width. `classic` reads theme.deviceWidthRatio. */
  widthRatio: number;
  /** Device centre as fractions of the composition width and tile height. */
  x: number;
  y: number;
  /** Degrees, clockwise, around the device centre. */
  rotate: number;
  capture: "primary" | "secondary";
  /**
   * The classic fit: shrink the device so it also fits between the copy block
   * and the bottom margin, then centre it in that band (y is ignored).
   */
  fitBelowCopy?: boolean;
};

/** Type and spacing as fractions of the tile width (sizes, padX) or tile height (padTop, gap). */
export const TYPE = {
  headlineSize: 0.082,
  headlineLineHeight: 1.08,
  headlineTracking: -0.0016,
  headlineWeight: 700,
  subheadSize: 0.038,
  subheadLineHeight: 1.3,
  subheadWeight: 400,
  padX: 0.09,
  padTop: 0.055,
  padBottom: 0.05,
  gap: 0.014,
} as const;

/** Badge pill geometry as fractions of the tile width (all but `inset`, of the shorter tile side). */
export const BADGE = {
  fontSize: 0.03,
  weight: 700,
  padX: 0.028,
  padY: 0.014,
  inset: 0.045,
} as const;

/** Space left under the device in the classic fit, as a fraction of the tile height. */
export const CLASSIC_BOTTOM_MARGIN = 0.03;

/** Drop shadow under a bare screen, as fractions of the tile width. */
export const SCREEN_SHADOW = { blur: 0.06, offsetY: 0.02, color: "rgba(0, 0, 0, 0.28)" } as const;

const single = (
  d: Partial<DevicePlacement> & Pick<DevicePlacement, "x" | "y">,
): DevicePlacement[] => [{ widthRatio: 0.84, rotate: 0, capture: "primary", ...d }];

export const LAYOUTS: Record<LayoutKey, LayoutSpec> = {
  classic: {
    key: "classic",
    label: "Classic",
    description: "Centred copy above a centred device.",
    span: 1,
    copy: { position: "top", align: "center" },
    devices: single({ x: 0.5, y: 0.5, fitBelowCopy: true }),
  },
  "copy-below": {
    key: "copy-below",
    label: "Copy below",
    description: "Device hanging from the top edge, copy underneath.",
    span: 1,
    copy: { position: "bottom", align: "center", heightRatio: 0.24 },
    devices: single({ widthRatio: 0.84, x: 0.5, y: 0.34 }),
  },
  hero: {
    key: "hero",
    label: "Hero",
    description: "Copy on top, a large device running off the bottom.",
    span: 1,
    copy: { position: "top", align: "center", heightRatio: 0.24 },
    devices: single({ widthRatio: 0.95, x: 0.5, y: 0.74 }),
  },
  offset: {
    key: "offset",
    label: "Offset",
    description: "Left-aligned copy, device pushed to the bottom right.",
    span: 1,
    copy: { position: "top", align: "left", heightRatio: 0.26 },
    devices: single({ widthRatio: 0.9, x: 0.62, y: 0.76 }),
  },
  tilt: {
    key: "tilt",
    label: "Tilt",
    description: "Copy on top, device tilted and running off the bottom.",
    span: 1,
    copy: { position: "top", align: "center", heightRatio: 0.24 },
    devices: single({ widthRatio: 0.9, x: 0.5, y: 0.75, rotate: -8 }),
  },
  "tilt-right": {
    key: "tilt-right",
    label: "Tilt right",
    description: "Left-aligned copy, device tilted into the bottom right corner.",
    span: 1,
    copy: { position: "top", align: "left", heightRatio: 0.26 },
    devices: single({ widthRatio: 0.9, x: 0.64, y: 0.78, rotate: 10 }),
  },
  duo: {
    key: "duo",
    label: "Duo",
    description: "Two screens: a smaller one behind on the left, the main one in front.",
    span: 1,
    copy: { position: "top", align: "center", heightRatio: 0.24 },
    devices: [
      { widthRatio: 0.62, x: 0.3, y: 0.62, rotate: 0, capture: "secondary" },
      { widthRatio: 0.7, x: 0.64, y: 0.72, rotate: 0, capture: "primary" },
    ],
  },
  "duo-tilt": {
    key: "duo-tilt",
    label: "Duo tilt",
    description: "Two tilted screens stepping down diagonally.",
    span: 1,
    copy: { position: "top", align: "center", heightRatio: 0.24 },
    devices: [
      { widthRatio: 0.64, x: 0.3, y: 0.6, rotate: -6, capture: "secondary" },
      { widthRatio: 0.7, x: 0.66, y: 0.74, rotate: -6, capture: "primary" },
    ],
  },
  panorama: {
    key: "panorama",
    label: "Panorama",
    description: "Two tiles: copy on the left, one big tilted device across the seam.",
    span: 2,
    copy: { position: "top", align: "left", heightRatio: 0.3, x: 0.045, widthRatio: 0.86 },
    devices: single({ widthRatio: 1.1, x: 0.56, y: 0.7, rotate: -10 }),
  },
  "panorama-duo": {
    key: "panorama-duo",
    label: "Panorama duo",
    description: "Two tiles sharing one headline, a screen on each side leaning inward.",
    span: 2,
    copy: { position: "top", align: "center", heightRatio: 0.24, widthRatio: 1.6 },
    devices: [
      { widthRatio: 0.8, x: 0.27, y: 0.7, rotate: 6, capture: "primary" },
      { widthRatio: 0.8, x: 0.73, y: 0.7, rotate: -6, capture: "secondary" },
    ],
  },
  minimal: {
    key: "minimal",
    label: "Minimal",
    description: "No copy, just the device, large and centred.",
    span: 1,
    copy: { position: "none", align: "center" },
    devices: single({ widthRatio: 0.92, x: 0.5, y: 0.5 }),
  },
};

export function isLayoutKey(key: string): key is LayoutKey {
  return (LAYOUT_KEYS as readonly string[]).includes(key);
}

/**
 * A template is the rhythm of a whole strip: the layout each screenshot
 * scene takes, in store order. A sequence shorter than the scene list
 * repeats from its start. Built-ins below; a config can give its own
 * sequence as an array of layout keys.
 */
export const TEMPLATE_KEYS = [
  "uniform",
  "editorial",
  "showcase",
  "magazine",
  "storyboard",
  "dynamic",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type TemplateSpec = {
  key: TemplateKey;
  label: string;
  description: string;
  sequence: LayoutKey[];
};

export const TEMPLATES: Record<TemplateKey, TemplateSpec> = {
  uniform: {
    key: "uniform",
    label: "Uniform",
    description: "Every tile in the theme's one layout.",
    sequence: [],
  },
  editorial: {
    key: "editorial",
    label: "Editorial",
    description: "A panorama opener, then a hero, an offset, a breather and a tilt.",
    sequence: ["panorama", "hero", "offset", "minimal", "tilt"],
  },
  showcase: {
    key: "showcase",
    label: "Showcase",
    description: "Hero first, then tilted and paired screens, ending on a breather.",
    sequence: ["hero", "tilt", "duo", "tilt-right", "minimal"],
  },
  magazine: {
    key: "magazine",
    label: "Magazine",
    description: "Left-aligned copy and copy-below tiles alternating with big devices.",
    sequence: ["offset", "copy-below", "tilt-right", "hero", "minimal"],
  },
  storyboard: {
    key: "storyboard",
    label: "Storyboard",
    description: "A two-screen panorama, then a copy-below, a hero and a breather.",
    sequence: ["panorama-duo", "copy-below", "hero", "minimal", "tilt"],
  },
  dynamic: {
    key: "dynamic",
    label: "Dynamic",
    description: "Everything tilted: a tilt, a tilted pair, a panorama, a breather.",
    sequence: ["tilt", "duo-tilt", "panorama", "minimal", "tilt-right"],
  },
};

export function isTemplateKey(key: string): key is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(key);
}

/** A template choice: a built-in key, or a custom sequence of layout keys. */
export type TemplateChoice = TemplateKey | LayoutKey[];

export function templateSequence(choice: TemplateChoice | undefined): LayoutKey[] {
  if (!choice) return [];
  return Array.isArray(choice) ? choice : TEMPLATES[choice].sequence;
}

/**
 * The layout each screenshot scene renders with, and where a two-screen
 * layout finds its second capture. Precedence: the scene's own `layout`,
 * then the template's entry for its position, then the theme layout, then
 * classic. A two-screen layout without a `secondScene` borrows the next
 * scene's capture (wrapping), so templates work on any config.
 */
export function resolveScenes<S extends { id: string; layout?: string; secondScene?: string }>(
  scenes: S[],
  opts: { template?: TemplateChoice; layout?: string; sceneLayouts?: Record<string, string> },
): Array<{ scene: S; layout: LayoutSpec; secondScene: string | undefined }> {
  const sequence = templateSequence(opts.template);
  const fallback = opts.layout && isLayoutKey(opts.layout) ? opts.layout : "classic";
  return scenes.map((scene, i) => {
    const key =
      opts.sceneLayouts?.[scene.id] ??
      scene.layout ??
      (sequence.length ? sequence[i % sequence.length] : undefined) ??
      fallback;
    const layout = LAYOUTS[isLayoutKey(key) ? key : "classic"];
    let secondScene = scene.secondScene;
    if (needsSecondCapture(layout) && !secondScene && scenes.length > 1) {
      secondScene = scenes[(i + 1) % scenes.length]!.id;
    }
    return { scene, layout, secondScene };
  });
}

export type Rect = { left: number; top: number; width: number; height: number };

export type Composition = {
  /** span × tile width, and the tile height. */
  width: number;
  height: number;
  /** Width the geometry was composed at; size type and shadows from this, not the tile. */
  designWidth: number;
  copy: {
    position: "top" | "bottom";
    align: CopyAlign;
    /** Anchor x: the centre line when centred, the left edge when left aligned. */
    x: number;
    /** Top of the block when `position` is "top", its bottom edge when "bottom". */
    y: number;
    maxWidth: number;
    /** The block's box, for the DOM twin. */
    box: Rect;
  } | null;
  devices: Array<{
    frame: Rect;
    screen: Rect & { radius: number };
    rotate: number;
    capture: "primary" | "secondary";
  }>;
};

/**
 * Pixel geometry for a layout on a tile of the given size. `screenOnly`
 * drops the bezel: the device box becomes the bare screen cutout. `geom` is
 * the device's bezel geometry (FRAMES in frame.ts); the iPhone's by default.
 */
/**
 * Every layout fraction was tuned on the App Store 6.9" tile (1320x2868). A
 * wider tile (Google Play's 9:16) would let width-driven device sizing climb
 * into the copy block, so composition happens in this reference aspect and the
 * column centres in the tile; reference-aspect tiles pass through unchanged.
 */
const REF_TILE_ASPECT = 1320 / 2868;

export function compose(
  spec: LayoutSpec,
  tileIn: { width: number; height: number },
  theme: { copyHeightRatio: number; deviceWidthRatio: number },
  opts: { screenOnly?: boolean; geom?: FrameGeometry } = {},
): Composition {
  const geom = opts.geom ?? FRAME;
  const tile =
    tileIn.width / tileIn.height > REF_TILE_ASPECT + 1e-6
      ? { width: tileIn.height * REF_TILE_ASPECT, height: tileIn.height }
      : tileIn;
  const dx = (spec.span * (tileIn.width - tile.width)) / 2;
  const width = tile.width * spec.span;
  const height = tile.height;
  const art = opts.screenOnly
    ? { width: geom.screen.width, height: geom.screen.height, screen: { x: 0, y: 0 } }
    : { width: geom.width, height: geom.height, screen: geom.screen };

  const isClassic = spec.key === "classic";
  const copyHeight =
    spec.copy.position === "none"
      ? 0
      : tile.height * (isClassic ? theme.copyHeightRatio : (spec.copy.heightRatio ?? 0.24));
  const padX = tile.width * TYPE.padX;
  const maxWidth = spec.copy.widthRatio ? tile.width * spec.copy.widthRatio : tile.width - 2 * padX;

  let copy: Composition["copy"] = null;
  if (spec.copy.position !== "none") {
    const x =
      spec.copy.x !== undefined
        ? width * spec.copy.x
        : spec.copy.align === "left"
          ? padX
          : width / 2;
    // Centred copy follows the reference column on a wide tile, but a
    // left-aligned block reads against the card's left edge, so it skips
    // the centring shift and keeps its inset from the real edge.
    const copyDx = spec.copy.align === "left" ? 0 : dx;
    const boxLeft = spec.copy.align === "left" ? x : x - maxWidth / 2;
    const top = spec.copy.position === "top" ? 0 : height - copyHeight;
    copy = {
      position: spec.copy.position,
      align: spec.copy.align,
      x: x + copyDx,
      y: spec.copy.position === "top" ? height * TYPE.padTop : height - height * TYPE.padBottom,
      maxWidth,
      box: { left: boxLeft + copyDx, top, width: maxWidth, height: copyHeight },
    };
  }

  // Copy composes in the reference column, but a device shrunk into it leaves
  // dead margins on a wider tile. Devices there keep their real-tile size and
  // slide until they clear the copy band — down past a top band, up past a
  // bottom one — bleeding off the far edge the way dense 9:16 frames do;
  // reference-aspect tiles skip both adjustments. A
  // copy-less layout (minimal) shows the whole device, so real-tile sizing
  // would push it past the tile's top and bottom; it keeps the reference size.
  const squat = tile !== tileIn;
  const devices = spec.devices.map((d) => {
    const widthRatio = isClassic ? theme.deviceWidthRatio : d.widthRatio;
    const deviceTile = squat && !d.fitBelowCopy && spec.copy.position !== "none" ? tileIn : tile;
    let scale = (deviceTile.width * widthRatio) / art.width;
    let left: number;
    let top: number;
    if (d.fitBelowCopy) {
      const bottomMargin = height * CLASSIC_BOTTOM_MARGIN;
      const available = height - copyHeight - bottomMargin;
      scale = Math.min(scale, available / art.height);
      left = (width - art.width * scale) / 2 + dx;
      top = copyHeight + (available - art.height * scale) / 2;
    } else {
      left = tileIn.width * spec.span * d.x - (art.width * scale) / 2;
      top = height * d.y - (art.height * scale) / 2;
      if (squat && copy && spec.copy.position === "top") {
        top = Math.max(top, copy.box.height + height * 0.015);
      }
      if (squat && copy && spec.copy.position === "bottom") {
        top = Math.min(top, copy.box.top - height * 0.015 - art.height * scale);
      }
    }
    return {
      frame: { left, top, width: art.width * scale, height: art.height * scale },
      screen: {
        left: left + art.screen.x * scale,
        top: top + art.screen.y * scale,
        width: geom.screen.width * scale,
        height: geom.screen.height * scale,
        radius: geom.screenRadius * scale,
      },
      rotate: d.rotate,
      capture: d.capture,
    };
  });

  return { width: tileIn.width * spec.span, height, copy, devices, designWidth: tile.width };
}

/** Whether a layout draws a second capture, which needs the scene's `secondScene`. */
export function needsSecondCapture(spec: LayoutSpec): boolean {
  return spec.devices.some((d) => d.capture === "secondary");
}
