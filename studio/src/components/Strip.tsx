import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, Reorder } from "motion/react";
import type React from "react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { findEmphasis } from "../../../src/copy";
import {
  BADGE,
  type Composition,
  compose,
  isTemplateKey,
  type LAYOUTS,
  type LayoutKey,
  resolveScenes,
  SCREEN_SHADOW,
  TYPE,
} from "../../../src/layouts";
import type {
  Decoration,
  Design,
  DesignScene,
  DeviceCaptures,
  DeviceEntry,
  FrameGeometry,
  SceneCopy,
  Theme,
} from "../manifest";
import { CHECKERBOARD, layoutOptions, TRANSPARENT } from "./DesignPanel";
import { Select } from "./Sidebar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/** Tiles shown at once; the App Store product page shows this many before scrolling. */
const PAGE_SIZE = 5;
/** Apple's cap on screenshots per device family. */
const MAX_SCREENSHOTS = 10;

/**
 * Page-turn animation: the incoming page slides in from the side the arrow
 * points at while the outgoing page leaves through the opposite edge. 110%
 * keeps a page's tile shadows clear of the clip edge until it is in motion.
 */
const pageSlide = {
  enter: (direction: number) => ({ x: direction > 0 ? "110%" : "-110%" }),
  center: { x: "0%" },
  exit: (direction: number) => ({ x: direction > 0 ? "-110%" : "110%" }),
};

/**
 * The five-up strip, composited in the browser: each screenshot tile is the
 * raw device capture inside the bezel art on the chosen background, laid out
 * with the exact geometry the CLI renders with (src/frame.ts), so what you see
 * is what an export renders. Background and frame arrive as props from React
 * state - changing them repaints instantly, no CLI involved. The preview tile
 * plays the raw clips as they are: Apple requires a plain screen recording.
 *
 * The App Store allows up to ten screenshots; the strip shows five tiles at a
 * time, and when there are more, arrows page through them like the store's
 * own carousel. Scenes past the tenth are dropped with a note.
 *
 * Every tile is a size-container: the geometry is computed in the device's
 * spec pixels and expressed in cqw/cqh, so the tile is the composition scaled
 * down. Captions under the tiles show the spec size the export will produce;
 * the video's turns red when the clips sum outside Apple's 15-30s window
 * (iOS only; the android video goes to YouTube, which has no bounds).
 *
 * In the lightbox the headline and subhead are editable in place; a change
 * is reported through onCopy for the current locale and layered over the
 * config's copy here and in the CLI, via goldie.design.json.
 *
 * Screenshot tiles can be dragged into a new order; the resulting scene id
 * list is reported through onReorder and saved the same way, so an export
 * numbers the files in the order shown. The preview tile stays first, as
 * the store shows it.
 */
export function Strip({
  design,
  captures,
  spec: tileSpec,
  locale,
  background,
  frameUrl,
  fontFamily,
  copy,
  onCopy,
  order,
  onReorder,
  template,
  layout,
  screenOnly,
  sceneLayouts,
  onSceneLayout,
}: {
  design: Design;
  captures: DeviceCaptures;
  spec: DeviceEntry;
  locale: string;
  background: string;
  frameUrl: string;
  fontFamily: string;
  copy: Record<string, SceneCopy>;
  onCopy: (
    sceneId: string,
    field: "headline" | "headlineEmphasis" | "subhead",
    text: string,
  ) => void;
  /** Screenshot scene ids in display order; empty means the config's order. */
  order: string[];
  onReorder: (order: string[]) => void;
  /** A built-in template key, "" for none, or a custom layout sequence. */
  template: string | string[];
  /** The default layout key, and per-scene overrides by scene id. */
  layout: string;
  screenOnly: boolean;
  sceneLayouts: Record<string, string>;
  onSceneLayout: (sceneId: string, key: string | undefined) => void;
}) {
  const theme = design.theme;
  const scenes =
    order.length > 0
      ? [...design.scenes].sort((a, b) => rankOf(order, a.id) - rankOf(order, b.id))
      : design.scenes;
  // The same resolution the CLI runs, on the scenes in their displayed order.
  const resolved = resolveScenes(scenes, {
    template: Array.isArray(template)
      ? (template as LayoutKey[])
      : isTemplateKey(template)
        ? template
        : undefined,
    layout,
    sceneLayouts,
  });
  const layoutOf = (scene: DesignScene) => resolved.find((r) => r.scene.id === scene.id)!;
  // The same resolution with no per-scene overrides: what the template (or
  // theme layout) gives each scene, which the lightbox names as "Default".
  const unforced = resolveScenes(scenes, {
    template: Array.isArray(template)
      ? (template as LayoutKey[])
      : isTemplateKey(template)
        ? template
        : undefined,
    layout,
  });
  const defaultLayoutOf = (scene: DesignScene) =>
    unforced.find((r) => r.scene.id === scene.id)!.layout.key;

  // Mirrors the CLI's --background handling: a dark background flips the copy
  // to light, a light background flips light copy colors to dark, and
  // per-scene background overrides are dropped, so the export matches what
  // is on screen.
  const bgLum = backgroundLuminance(background);
  const dark = bgLum !== null && bgLum < 0.5;
  const light = bgLum !== null && bgLum >= 0.5;
  const lightColor = (c: string) => (backgroundLuminance(c) ?? 0) > 0.5;
  const headlineColor = dark
    ? "#FFFFFF"
    : light && lightColor(theme.headlineColor)
      ? "#0E1B2A"
      : theme.headlineColor;
  const subheadColor = dark
    ? "#D9E1EA"
    : light && lightColor(theme.subheadColor)
      ? "#5A6A7D"
      : theme.subheadColor;
  const accentColor = theme.accentColor ?? headlineColor;

  const allShots = scenes.flatMap((scene) => {
    const capture = captures.screenshots.find((s) => s.sceneId === scene.id);
    return capture ? [{ scene, capture }] : [];
  });
  // Apple's cap counts tiles, so a panorama scene uses two of the ten.
  let used = 0;
  const shots = allShots.filter(({ scene }) => {
    used += layoutOf(scene).layout.span;
    return used <= MAX_SCREENSHOTS;
  });
  const dropped = allShots.length - shots.length;

  const segments =
    design.preview && captures.clips
      ? design.preview.segments.flatMap((seg) => {
          const clip = captures.clips!.find((c) => c.segmentId === seg.id);
          return clip ? [{ url: clip.url, durationSeconds: clip.durationSeconds }] : [];
        })
      : [];

  const totalSeconds = segments.reduce((s, c) => s + c.durationSeconds, 0);

  // A device with its own bezel art (android) ignores the frame picker: the
  // picker's variants are iPhone art, with iPhone geometry.
  const deviceFrameUrl = tileSpec.frame?.url ?? frameUrl;
  const geom = tileSpec.frame?.geom;

  type Entry = {
    key: string;
    width: number;
    height: number;
    bad: boolean;
    badReason?: string;
    /** Whether the lightbox offers in-place copy editing (screenshots only). */
    editable: boolean;
    /** The composition; editable renders the copy as editable text (lightbox only). */
    scene: (editable: boolean) => ReactNode;
    /** Set on screenshot tiles, which can be dragged into a new order. */
    sceneId?: string;
    /** The lightbox's per-scene layout override control (screenshots only). */
    layout?: {
      value: string | undefined;
      /** The layout the scene gets with no override: the template's pick, or the theme layout. */
      defaultKey: string;
      onChange: (key: string | undefined) => void;
    };
    emphasis?: {
      value: string;
      valid: boolean;
      onChange: (value: string) => void;
    };
  };
  const entries: Entry[] = [];
  if (segments.length > 0 && tileSpec.preview) {
    // The 15-30s window is Apple's upload rule; the android video goes to
    // YouTube, which has no duration bounds.
    const outOfBounds = tileSpec.platform === "ios" && (totalSeconds < 15 || totalSeconds > 30);
    entries.push({
      key: "preview",
      width: tileSpec.preview.width,
      height: tileSpec.preview.height,
      bad: outOfBounds,
      badReason: "Clips sum outside the 15-30s Apple allows for previews.",
      editable: false,
      scene: () => <PreviewScene segments={segments} />,
    });
  }
  for (const { scene, capture } of shots) {
    const { layout: spec, secondScene } = layoutOf(scene);
    const second = secondScene
      ? captures.screenshots.find((s) => s.sceneId === secondScene)
      : undefined;
    const layoutControl = {
      value: sceneLayouts[scene.id],
      defaultKey: defaultLayoutOf(scene),
      onChange: (key: string | undefined) => onSceneLayout(scene.id, key),
    };
    const headline = copy[scene.id]?.headline?.[locale] ?? scene.headline[locale] ?? "";
    const headlineEmphasis =
      copy[scene.id]?.headlineEmphasis?.[locale] ?? scene.headlineEmphasis?.[locale] ?? "";
    const emphasisControl = {
      value: headlineEmphasis,
      valid: !headlineEmphasis.trim() || Boolean(findEmphasis(headline, headlineEmphasis)),
      onChange: (value: string) => onCopy(scene.id, "headlineEmphasis", value),
    };
    for (let slice = 0; slice < spec.span; slice++) {
      entries.push({
        key: spec.span > 1 ? `${scene.id}#${slice + 1}` : scene.id,
        width: tileSpec.screenshot.width,
        height: tileSpec.screenshot.height,
        bad: false,
        editable: true,
        // Only the first slice drags; the second follows it.
        sceneId: slice === 0 ? scene.id : undefined,
        layout: layoutControl,
        emphasis: emphasisControl,
        scene: (editable) => (
          <ScreenshotScene
            spec={spec}
            slice={slice}
            tile={tileSpec.screenshot}
            theme={theme}
            screenOnly={screenOnly}
            background={background}
            frameUrl={deviceFrameUrl}
            geom={geom}
            fontFamily={fontFamily}
            headline={headline}
            headlineEmphasis={headlineEmphasis}
            subhead={copy[scene.id]?.subhead?.[locale] ?? scene.subhead?.[locale]}
            headlineColor={headlineColor}
            accentColor={accentColor}
            subheadColor={subheadColor}
            captureUrl={capture.url}
            secondCaptureUrl={second?.url}
            secondSceneId={secondScene}
            decorations={[...design.decorations, ...(scene.decorations ?? [])]}
            locale={locale}
            onEdit={editable ? (field, text) => onCopy(scene.id, field, text) : undefined}
          />
        ),
      });
    }
  }

  const [open, setOpenState] = useState<number | null>(null);
  // The tile that shares its view-transition-name with the lightbox scene.
  // It must already be named in the frame *before* the transition starts,
  // or the old snapshot has nothing to morph from; so it is committed
  // synchronously first, and only cleared once the closing morph is done.
  const [named, setNamed] = useState<number | null>(null);
  const setOpen = (next: number | null) => {
    if (typeof document.startViewTransition !== "function") {
      setNamed(next);
      setOpenState(next);
      return;
    }
    if (next !== null) flushSync(() => setNamed(next));
    const transition = document.startViewTransition(() => flushSync(() => setOpenState(next)));
    if (next === null) transition.finished.finally(() => setNamed(null));
  };
  // A pointer drag on a tile also produces a click when it ends; the click
  // is dropped while a drag is underway or just finished.
  const dragged = useRef(false);
  // The scene being dragged, lifted with a slight scale. Driven through
  // `animate` rather than whileDrag, which can stay applied when the drop
  // coincides with the item's layout animation.
  const [lifting, setLifting] = useState<string | null>(null);
  const tileAt = (i: number) => {
    const entry = entries[i];
    return (
      <Tile
        key={entry.key}
        draggable={entry.sceneId !== undefined}
        width={entry.width}
        height={entry.height}
        bad={entry.bad}
        badReason={entry.badReason}
        onOpen={() => {
          if (!dragged.current) setOpen(i);
        }}
        // Named only while the lightbox is closed: once open, the scene inside
        // it carries the name, and a duplicate would abort the transition.
        transitionName={named === i && open === null ? "lightbox-scene" : undefined}
      >
        {entry.scene(false)}
      </Tile>
    );
  };

  // Strip cells: the preview tile, then one cell per scene holding its
  // tile(s), so a panorama's two slices drag together. Cells are paged so a
  // page holds at most PAGE_SIZE tiles without splitting a scene.
  type Cell = { sceneId?: string; tiles: number[] };
  const cells: Cell[] = [];
  entries.forEach((entry, i) => {
    const last = cells[cells.length - 1];
    if (entry.sceneId === undefined && last?.sceneId !== undefined && entry.key.includes("#")) {
      last.tiles.push(i);
    } else {
      cells.push({ sceneId: entry.sceneId, tiles: [i] });
    }
  });
  const pageCells: Cell[][] = [[]];
  for (const cell of cells) {
    const current = pageCells[pageCells.length - 1];
    const used = current.reduce((n, c) => n + c.tiles.length, 0);
    if (used + cell.tiles.length > PAGE_SIZE && current.length > 0) pageCells.push([cell]);
    else current.push(cell);
  }
  const pages = pageCells.length;
  const [page, setPage] = useState(0);
  // Which way the last page turn went, so the incoming page slides in from
  // that side and the outgoing one leaves through the other.
  const [direction, setDirection] = useState(0);
  const turnPage = (delta: number) => {
    setDirection(delta);
    setPage((p) => p + delta);
  };
  // A device switch can shrink the tile count; keep the page in range.
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);
  useEffect(() => {
    if (open !== null && open > entries.length - 1) {
      setOpenState(null);
      setNamed(null);
    }
  }, [open, entries.length]);

  if (entries.length === 0) return null;

  const visible = pageCells[Math.min(page, pages - 1)];
  const visibleIds = visible.flatMap((c) => (c.sceneId ? [c.sceneId] : []));
  // Pad the last page so tiles keep the same width as on a full page.
  const columns = pages > 1 ? PAGE_SIZE : entries.length;
  // The page's scenes in their new order, spliced back into the full order.
  const reorderPage = (ids: string[]) => {
    const queue = [...ids];
    onReorder(scenes.map((s) => (visibleIds.includes(s.id) ? queue.shift()! : s.id)));
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative">
        {/* Clips only horizontally, so a sliding page vanishes at the strip's
            edge while tile shadows and the hover lift stay visible; the small
            padding keeps the edge tiles' own shadows out of the clip. */}
        <div className="-mx-2 overflow-x-clip px-2">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <Reorder.Group
              key={page}
              axis="x"
              values={visibleIds}
              onReorder={reorderPage}
              aria-label="Screenshots, drag to reorder"
              className="grid w-full list-none items-start gap-4 p-0"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              custom={direction}
              variants={pageSlide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
            >
              {visible.map((cell) =>
                cell.sceneId ? (
                  <Reorder.Item
                    key={cell.sceneId}
                    value={cell.sceneId}
                    className="relative grid gap-4"
                    style={{
                      zIndex: lifting === cell.sceneId ? 10 : undefined,
                      gridColumn: `span ${cell.tiles.length}`,
                      gridTemplateColumns: `repeat(${cell.tiles.length}, minmax(0, 1fr))`,
                    }}
                    animate={{ scale: lifting === cell.sceneId ? 1.04 : 1 }}
                    onDragStart={() => {
                      dragged.current = true;
                      setLifting(cell.sceneId ?? null);
                    }}
                    onDragEnd={() => {
                      setLifting(null);
                      setTimeout(() => {
                        dragged.current = false;
                      }, 0);
                    }}
                  >
                    {cell.tiles.map(tileAt)}
                  </Reorder.Item>
                ) : (
                  <li key={entries[cell.tiles[0]].key}>{tileAt(cell.tiles[0])}</li>
                ),
              )}
            </Reorder.Group>
          </AnimatePresence>
        </div>

        {pages > 1 ? (
          <>
            <PagerButton
              side="left"
              label="Previous screenshots"
              disabled={page === 0}
              onClick={() => turnPage(-1)}
            />
            <PagerButton
              side="right"
              label="Next screenshots"
              disabled={page === pages - 1}
              onClick={() => turnPage(1)}
            />
          </>
        ) : null}
      </div>

      {dropped > 0 ? (
        <p className="text-center text-[11px] font-medium text-destructive">
          {dropped} more scene{dropped === 1 ? "" : "s"} hidden: the App Store allows{" "}
          {MAX_SCREENSHOTS} screenshots.
        </p>
      ) : null}

      {open !== null && entries[open] ? (
        <Lightbox
          entry={entries[open]}
          layouts={design.layouts}
          index={open}
          count={entries.length}
          onClose={() => setOpen(null)}
          // Stepping swaps the scene in place with no morph.
          onStep={(delta) => {
            if (open === null) return;
            const next = Math.min(entries.length - 1, Math.max(0, open + delta));
            setNamed(next);
            setOpenState(next);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Full-viewport view of one tile: the same composition, rendered as large as
 * the window allows at the spec's aspect ratio. Click outside, Escape, or the
 * close button dismiss it; arrow keys step between tiles. Keys typed into the
 * editable copy are left to the text.
 */
function Lightbox({
  entry,
  layouts,
  index,
  count,
  onClose,
  onStep,
}: {
  entry: {
    width: number;
    height: number;
    editable: boolean;
    scene: (editable: boolean) => ReactNode;
    layout?: {
      value: string | undefined;
      /** The layout the scene gets with no override: the template's pick, or the theme layout. */
      defaultKey: string;
      onChange: (key: string | undefined) => void;
    };
    emphasis?: {
      value: string;
      valid: boolean;
      onChange: (value: string) => void;
    };
  };
  layouts: Design["layouts"];
  index: number;
  count: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onStep(-1);
      else if (e.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
      className="animate-in fade-in fixed inset-0 z-50 flex duration-150 flex-col items-center justify-center gap-3 bg-black/80 p-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
        style={{
          viewTransitionName: "lightbox-scene",
          aspectRatio: `${entry.width} / ${entry.height}`,
          // Sized by width alone so the aspect ratio always holds: a height
          // cap plus flex shrinking would squash the box, stretching the bezel
          // art off the cover-fitted capture (a misaligned camera cutout). The
          // 7.5rem clears the padding, gap and layout row below the scene.
          flexShrink: 0,
          width: `min(calc(100vw - 4rem), calc((100vh - 7.5rem) * ${entry.width / entry.height}))`,
        }}
      >
        {entry.scene(true)}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-neutral-300">
        {entry.layout ? (
          <div className="dark w-44 text-foreground">
            <Select
              value={entry.layout.value ?? ""}
              onChange={(v) => entry.layout?.onChange(v || undefined)}
              options={[
                [
                  "",
                  `Default (${layouts.find((l) => l.key === entry.layout?.defaultKey)?.label ?? entry.layout.defaultKey})`,
                ],
                ...layoutOptions(layouts),
              ]}
            />
          </div>
        ) : null}
        {entry.emphasis ? (
          <label htmlFor="headline-emphasis" className="dark grid w-56 gap-1 text-foreground">
            <span className="font-medium text-neutral-300">Accent phrase</span>
            <Input
              id="headline-emphasis"
              value={entry.emphasis.value}
              aria-invalid={!entry.emphasis.valid}
              placeholder="Exact phrase from headline"
              onChange={(event) => entry.emphasis?.onChange(event.target.value)}
            />
            {!entry.emphasis.valid ? (
              <span className="text-destructive">Phrase must occur in the headline.</span>
            ) : null}
          </label>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full"
        onClick={onClose}
      >
        <X />
      </Button>
      {count > 1 ? (
        <>
          <PagerButton
            side="left"
            label="Previous"
            disabled={index === 0}
            onClick={() => onStep(-1)}
            inset
          />
          <PagerButton
            side="right"
            label="Next"
            disabled={index === count - 1}
            onClick={() => onStep(1)}
            inset
          />
        </>
      ) : null}
    </div>
  );
}

/** Round arrow floating over the strip's edge, like the store carousel's. */
function PagerButton({
  side,
  label,
  disabled,
  onClick,
  inset = false,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
  /** Sit inside the edge instead of overhanging it (used in the lightbox). */
  inset?: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const offset = inset
    ? side === "left"
      ? "left-4"
      : "right-4"
    : side === "left"
      ? "-left-5"
      : "-right-5";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-popover shadow-md transition-none hover:bg-popover focus-visible:ring-0 active:not-aria-[haspopup]:-translate-y-1/2 ${offset}`}
    >
      <Icon />
    </Button>
  );
}

/** Container-query units: 1cqw / 1cqh is one percent of a single tile. */
const cq = (tile: { width: number; height: number }) => ({
  w: (v: number) => `${(v / tile.width) * 100}cqw`,
  h: (v: number) => `${(v / tile.height) * 100}cqh`,
});

function Canvas({
  background,
  fontFamily,
  children,
}: {
  background: string;
  fontFamily: string;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: "size", background, fontFamily }}
    >
      {children}
    </div>
  );
}

/**
 * Browser twin of renderScreenshots in src/render.ts: the same compose()
 * geometry, expressed in container-query units of one tile. A panorama
 * layout renders the whole span-wide composition and shifts it left by
 * `slice` tiles, so each tile shows its own slice. With onEdit set, the
 * headline and subhead are contentEditable and report their text when
 * editing ends (blur, or Enter).
 */
function ScreenshotScene({
  spec,
  slice,
  tile,
  theme,
  screenOnly,
  background,
  frameUrl,
  geom,
  fontFamily,
  headline,
  headlineEmphasis,
  subhead,
  headlineColor,
  accentColor,
  subheadColor,
  captureUrl,
  secondCaptureUrl,
  secondSceneId,
  decorations,
  locale,
  onEdit,
}: {
  spec: (typeof LAYOUTS)[keyof typeof LAYOUTS];
  slice: number;
  tile: { width: number; height: number };
  theme: Theme;
  screenOnly: boolean;
  background: string;
  frameUrl: string;
  /** The bezel art's geometry; the iOS bundled art's when the device brings none. */
  geom: FrameGeometry | undefined;
  fontFamily: string;
  headline: string;
  headlineEmphasis: string;
  subhead: string | undefined;
  headlineColor: string;
  accentColor: string;
  subheadColor: string;
  captureUrl: string;
  secondCaptureUrl: string | undefined;
  secondSceneId: string | undefined;
  decorations: Decoration[];
  locale: string;
  onEdit?: (field: "headline" | "subhead", text: string) => void;
}) {
  const c = compose(spec, tile, theme, { screenOnly, geom });
  const { w, h } = cq(tile);
  // Wider-than-reference tiles compose at a narrower design width; type follows it.
  const typeScale = c.designWidth / tile.width;
  const editable = onEdit ? editableProps : () => ({});
  const copy = c.copy;
  return (
    <Canvas background="transparent" fontFamily={fontFamily}>
      {/* The full composition; the background spans it so a gradient runs across a panorama. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${-slice * 100}%`,
          width: `${spec.span * 100}%`,
          height: "100%",
          background: background === TRANSPARENT ? CHECKERBOARD : background,
        }}
      >
        {copy ? (
          <div
            style={{
              position: "absolute",
              left: w(copy.box.left),
              width: w(copy.box.width),
              ...(copy.position === "top"
                ? { top: 0, paddingTop: h(copy.y), justifyContent: "flex-start" }
                : {
                    bottom: 0,
                    paddingBottom: h(tile.height - copy.y),
                    justifyContent: "flex-end",
                  }),
              height: h(copy.box.height),
              display: "flex",
              flexDirection: "column",
              alignItems: copy.align === "left" ? "flex-start" : "center",
              gap: h(tile.height * TYPE.gap),
              textAlign: copy.align,
            }}
          >
            <h1
              style={{
                margin: 0,
                color: headlineColor,
                fontSize: `${TYPE.headlineSize * typeScale * 100}cqw`,
                lineHeight: TYPE.headlineLineHeight,
                fontWeight: TYPE.headlineWeight,
                letterSpacing: `${TYPE.headlineTracking * typeScale * 100}cqw`,
              }}
              {...editable((text) => onEdit?.("headline", text), headline, "Headline")}
            >
              <EmphasizedText text={headline} phrase={headlineEmphasis} color={accentColor} />
            </h1>
            {subhead || onEdit ? (
              <p
                style={{
                  margin: 0,
                  color: subheadColor,
                  fontSize: `${TYPE.subheadSize * typeScale * 100}cqw`,
                  lineHeight: TYPE.subheadLineHeight,
                  fontWeight: TYPE.subheadWeight,
                  minWidth: "30cqw",
                }}
                {...editable((text) => onEdit?.("subhead", text), subhead ?? "", "Subhead")}
              >
                {subhead}
              </p>
            ) : null}
          </div>
        ) : null}

        <Decorations decorations={decorations} tile={tile} locale={locale} color={headlineColor} />

        {c.devices.map((device) => {
          const url = device.capture === "secondary" ? secondCaptureUrl : captureUrl;
          return (
            <DeviceView
              key={device.capture}
              device={device}
              tile={tile}
              frameUrl={screenOnly ? null : frameUrl}
              captureUrl={url}
              missing={url ? undefined : (secondSceneId ?? "secondScene")}
            />
          );
        })}
      </div>
    </Canvas>
  );
}

/**
 * One device: the capture cover-fitted inside the rounded screen, the bezel
 * over it, or a drop shadow under the bare screen when there is no bezel.
 * The box rotates about its centre, matching the canvas transform.
 */
function DeviceView({
  device,
  tile,
  frameUrl,
  captureUrl,
  missing,
}: {
  device: Composition["devices"][number];
  tile: { width: number; height: number };
  frameUrl: string | null;
  captureUrl: string | undefined;
  /** Scene id to name in the placeholder when the capture is missing. */
  missing: string | undefined;
}) {
  const { w, h } = cq(tile);
  const { frame, screen } = device;
  // The screen as fractions of the device box, so it rotates with it.
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div
      style={{
        position: "absolute",
        left: w(frame.left),
        top: h(frame.top),
        width: w(frame.width),
        height: h(frame.height),
        transform: device.rotate ? `rotate(${device.rotate}deg)` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pct(screen.left - frame.left, frame.width),
          top: pct(screen.top - frame.top, frame.height),
          width: pct(screen.width, frame.width),
          height: pct(screen.height, frame.height),
          borderRadius: w(screen.radius),
          overflow: "hidden",
          background: "#000",
          boxShadow: frameUrl
            ? undefined
            : `0 ${w(tile.width * SCREEN_SHADOW.offsetY)} ${w(tile.width * SCREEN_SHADOW.blur)} ${SCREEN_SHADOW.color}`,
        }}
      >
        {captureUrl ? (
          <img
            src={`/${captureUrl}`}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center border-4 border-dashed border-neutral-500 bg-neutral-800 text-center text-neutral-300"
            style={{ fontSize: "3cqw", padding: "4cqw" }}
          >
            no capture for {missing}
          </div>
        )}
      </div>
      {frameUrl ? (
        <img
          src={`/${frameUrl}`}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : null}
    </div>
  );
}

/** Badge pills in the composition's corners and image layers placed by tile fractions. */
function Decorations({
  decorations,
  tile,
  locale,
  color,
}: {
  decorations: Decoration[];
  tile: { width: number; height: number };
  locale: string;
  color: string;
}) {
  const { w, h } = cq(tile);
  const inset = Math.min(tile.width, tile.height) * BADGE.inset;
  return (
    <>
      {decorations.map((d, i) =>
        d.kind === "badge" ? (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static list from the config
            key={i}
            style={{
              position: "absolute",
              ...(d.position.endsWith("left") ? { left: w(inset) } : { right: w(inset) }),
              ...(d.position.startsWith("top") ? { top: h(inset) } : { bottom: h(inset) }),
              padding: `${w(tile.width * BADGE.padY)} ${w(tile.width * BADGE.padX)}`,
              borderRadius: "999cqw",
              background: d.background ?? "rgba(255, 255, 255, 0.85)",
              color: d.color ?? color,
              fontSize: `${BADGE.fontSize * 100}cqw`,
              lineHeight: 1.2,
              fontWeight: BADGE.weight,
              whiteSpace: "nowrap",
            }}
          >
            {d.text[locale] ?? ""}
          </div>
        ) : (
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: static list from the config
            key={i}
            src={`/${d.src}`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: w(tile.width * d.x),
              top: h(tile.height * d.y),
              width: w(tile.width * d.width),
              height: "auto",
              transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined,
            }}
          />
        ),
      )}
    </>
  );
}

/**
 * Props that make a copy element editable in place. The text is committed
 * on blur or Enter (Shift+Enter keeps a line break, as the export honours
 * newlines); Escape restores the current value and leaves the field.
 */
function editableProps(commit: (text: string) => void, current: string, label: string) {
  return {
    contentEditable: "plaintext-only" as const,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-label": label,
    "data-placeholder": label,
    spellCheck: false,
    className: "editable-copy",
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const text = e.currentTarget.innerText.replace(/\n+$/, "");
      if (text !== current) commit(text);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.currentTarget.innerText = current;
        e.currentTarget.blur();
      }
    },
  };
}

function EmphasizedText({ text, phrase, color }: { text: string; phrase: string; color: string }) {
  const range = findEmphasis(text, phrase);
  if (!range) return text;
  return (
    <>
      {text.slice(0, range.start)}
      <span style={{ color }}>{text.slice(range.start, range.end)}</span>
      {text.slice(range.end)}
    </>
  );
}

/**
 * Plays the raw clips back to back, unframed, exactly as the exported video
 * joins them. Always muted - the configured audio bed only exists in the
 * exported video.
 */
function PreviewScene({ segments }: { segments: Array<{ url: string; durationSeconds: number }> }) {
  const [index, setIndex] = useState(0);
  const segment = segments[index % segments.length]!;
  return (
    // Remounting on every advance restarts playback even with one clip.
    <video
      key={index}
      src={`/${segment.url}`}
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => setIndex((i) => i + 1)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/**
 * One strip tile. Screenshot tiles sit inside a Reorder.Item, which handles
 * the drag; a click still opens the lightbox.
 */
function Tile({
  width,
  height,
  bad,
  badReason,
  onOpen,
  transitionName,
  draggable,
  children,
}: {
  width: number;
  height: number;
  bad: boolean;
  badReason?: string;
  onOpen: () => void;
  transitionName?: string;
  draggable: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-label={
          draggable ? "Open full-size preview (drag to reorder)" : "Open full-size preview"
        }
        title={draggable ? "Drag to reorder" : undefined}
        onClick={onOpen}
        className={`tile-shadow relative block w-full overflow-hidden rounded-2xl bg-neutral-200 ring-1 ring-black/10 transition-[transform,box-shadow,--tw-ring-color] duration-150 select-none hover:-translate-y-0.5 hover:ring-black/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:bg-neutral-800 dark:ring-white/10 dark:hover:ring-white/30 ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
        style={{ aspectRatio: `${width} / ${height}`, viewTransitionName: transitionName }}
      >
        {children}
      </button>
      {bad ? (
        <p className="pt-2 text-center text-[11px] font-medium text-destructive">{badReason}</p>
      ) : null}
    </div>
  );
}

/** Position of a scene id in the saved order; unlisted ids sort last, in config order. */
function rankOf(order: string[], id: string): number {
  const i = order.indexOf(id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/**
 * Mirror of the CLI's backgroundLuminance: mean relative luminance of the
 * value's six-digit hex colors, or null when it has none.
 */
function backgroundLuminance(css: string): number | null {
  const hexes = css.match(/#[0-9a-fA-F]{6}/g);
  if (!hexes || hexes.length === 0) return null;
  const luminance = (hex: string) => {
    const channel = (offset: number) => {
      const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  return hexes.reduce((sum, hex) => sum + luminance(hex), 0) / hexes.length;
}
