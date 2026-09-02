import { describe, expect, test } from "bun:test";
import { FRAMES } from "./frame.ts";
import { compose, LAYOUT_KEYS, LAYOUTS, needsSecondCapture, resolveScenes } from "./layouts.ts";
import { DEVICES } from "./specs.ts";

const tile = { width: 1320, height: 2868 };
const theme = { copyHeightRatio: 0.24, deviceWidthRatio: 0.84 };

describe("compose", () => {
  test("classic reproduces the original single-layout geometry", () => {
    // Frozen from frame.ts's layout() before it was replaced.
    const c = compose(LAYOUTS.classic, tile, theme);
    expect(c.width).toBe(1320);
    expect(c.devices).toHaveLength(1);
    const { frame, screen } = c.devices[0]!;
    expect(frame.left).toBeCloseTo(153.3123642172523, 6);
    expect(frame.top).toBeCloseTo(688.32, 6);
    expect(frame.width).toBeCloseTo(1013.3752715654954, 6);
    expect(frame.height).toBeCloseTo(2093.64, 6);
    expect(screen.left).toBeCloseTo(193.44603833865807, 6);
    expect(screen.top).toBeCloseTo(723.43696485623, 6);
    expect(screen.width).toBeCloseTo(931.4356869009587, 6);
    expect(screen.height).toBeCloseTo(2023.4060702875404, 6);
    expect(screen.radius).toBeCloseTo(137.12338658146967, 6);
    expect(c.copy).toMatchObject({ position: "top", align: "center", x: 660 });
    expect(c.copy!.y).toBeCloseTo(2868 * 0.055);
    expect(c.copy!.maxWidth).toBeCloseTo(1320 - 2 * 1320 * 0.09);
  });

  test("every layout composes to finite geometry and its span", () => {
    for (const key of LAYOUT_KEYS) {
      const spec = LAYOUTS[key];
      const c = compose(spec, tile, theme);
      expect(c.width).toBe(tile.width * spec.span);
      expect(c.height).toBe(tile.height);
      expect(c.devices).toHaveLength(spec.devices.length);
      for (const d of c.devices) {
        for (const v of Object.values({ ...d.frame, ...d.screen }))
          expect(Number.isFinite(v)).toBe(true);
        expect(d.screen.width).toBeLessThanOrEqual(d.frame.width);
      }
      if (spec.copy.position === "none") expect(c.copy).toBeNull();
      else expect(c.copy).not.toBeNull();
    }
  });

  test("screen-only makes the device box the screen itself", () => {
    const c = compose(LAYOUTS.hero, tile, theme, { screenOnly: true });
    const { frame, screen } = c.devices[0]!;
    expect(screen.left).toBe(frame.left);
    expect(screen.top).toBe(frame.top);
    expect(screen.width).toBe(frame.width);
    expect(screen.height).toBe(frame.height);
  });

  test("a layout composes against the device's own frame geometry", () => {
    const ipad = { width: 2064, height: 2752 };
    const art = FRAMES["ipad-13"];
    const c = compose(LAYOUTS.classic, ipad, theme, { geom: art });
    const { frame, screen } = c.devices[0]!;
    const scale = frame.width / art.width;
    expect(screen.left).toBeCloseTo(frame.left + art.screen.x * scale, 6);
    expect(screen.top).toBeCloseTo(frame.top + art.screen.y * scale, 6);
    expect(screen.width).toBeCloseTo(art.screen.width * scale, 6);
    expect(screen.radius).toBeCloseTo(art.screenRadius * scale, 6);
    expect(frame.top + frame.height).toBeLessThanOrEqual(ipad.height);
  });

  test("every bezel's cutout matches its device's capture aspect", () => {
    // A cutout that drifts from the capture's aspect crops the screenshot,
    // since drawDevice cover-fits the capture into it.
    for (const [key, art] of Object.entries(FRAMES)) {
      const spec = DEVICES[key as keyof typeof DEVICES];
      // Android captures come at the emulator's own size (native: null) and
      // the Pixel cutout cover-crops them; the 16:9 Play tile is not the
      // capture aspect, so the check only holds on iOS.
      if (spec.native === null) continue;
      const cutout = art.screen.width / art.screen.height;
      const capture = spec.screenshot.width / spec.screenshot.height;
      expect(Math.abs(cutout / capture - 1)).toBeLessThan(0.01);
    }
  });

  test("duo and panorama-duo need a second capture, the rest do not", () => {
    const duo = LAYOUT_KEYS.filter((k) => needsSecondCapture(LAYOUTS[k]));
    expect(duo.sort()).toEqual(["duo", "duo-tilt", "panorama-duo"]);
  });

  test("bottom copy anchors at the bottom edge", () => {
    const c = compose(LAYOUTS["copy-below"], tile, theme);
    expect(c.copy!.position).toBe("bottom");
    expect(c.copy!.box.top + c.copy!.box.height).toBe(tile.height);
    expect(c.copy!.y).toBeCloseTo(tile.height * (1 - 0.05));
  });

  test("on a wide tile left-aligned copy stays at the card's left edge", () => {
    const wide = { width: 1080, height: 1920 };
    const narrow = compose(LAYOUTS.panorama, tile, theme);
    const c = compose(LAYOUTS.panorama, wide, theme);
    // The centring shift moves centred copy but never a left-aligned block.
    expect(c.copy!.box.left).toBeCloseTo(narrow.copy!.box.left * (c.designWidth / tile.width));
    const centred = compose(LAYOUTS.hero, wide, theme);
    expect(centred.copy!.box.left).toBeGreaterThan(0);
  });

  test("on a wide tile the device clears a bottom copy band", () => {
    const wide = { width: 1080, height: 1920 };
    const c = compose(LAYOUTS["copy-below"], wide, theme);
    const { frame } = c.devices[0]!;
    expect(frame.top + frame.height).toBeLessThanOrEqual(c.copy!.box.top - wide.height * 0.015);
  });
});

describe("resolveScenes", () => {
  const scenes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }];

  test("a template assigns layouts by position and repeats when shorter", () => {
    const r = resolveScenes(scenes, { template: "editorial" });
    expect(r.map((x) => x.layout.key)).toEqual([
      "panorama",
      "hero",
      "offset",
      "minimal",
      "tilt",
      "panorama",
    ]);
  });

  test("a custom sequence works the same way", () => {
    const r = resolveScenes(scenes.slice(0, 3), { template: ["tilt", "minimal"] });
    expect(r.map((x) => x.layout.key)).toEqual(["tilt", "minimal", "tilt"]);
  });

  test("scene layout beats the template, which beats the theme layout", () => {
    const r = resolveScenes([{ id: "a", layout: "hero" }, { id: "b" }, { id: "c" }], {
      template: ["tilt"],
      layout: "minimal",
      sceneLayouts: { c: "offset" },
    });
    expect(r.map((x) => x.layout.key)).toEqual(["hero", "tilt", "offset"]);
    const none = resolveScenes([{ id: "a" }], { layout: "minimal" });
    expect(none[0]!.layout.key).toBe("minimal");
  });

  test("two-screen layouts borrow the next scene's capture unless told otherwise", () => {
    const r = resolveScenes([{ id: "a" }, { id: "b", secondScene: "a" }, { id: "c" }], {
      template: ["duo"],
    });
    expect(r.map((x) => x.secondScene)).toEqual(["b", "a", "a"]);
    expect(resolveScenes([{ id: "only" }], { template: ["duo"] })[0]!.secondScene).toBeUndefined();
  });
});
