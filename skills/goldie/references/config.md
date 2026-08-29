# goldie.config.ts

One file holds everything app-specific. It exports a `GoldieConfig` (type from
`$GOLDIE/src/config.ts`). Every relative path in it resolves against the config
file itself, and `out/` is created next to it. Scene flows are the exception:
they are argent flow names resolved against `flowsDir`, which defaults to
`.argent/flows` inside `appRoot`.

## Annotated example

```ts
import type { GoldieConfig } from "/Users/<you>/Dev/goldie/src/config.ts";

const APP_ROOT = "/absolute/path/to/the/app/repo";

const config: GoldieConfig = {
  appRoot: APP_ROOT,
  // The Release simulator build found in Step 1. Absolute path.
  appPath: `${process.env.HOME}/Library/Developer/Xcode/DerivedData/<App>-<hash>/Build/Products/Release-iphonesimulator/<App>.app`,
  bundleId: "com.example.app",

  // Google Play too: add "android-phone" and the android block below. Scenes
  // and flows are shared across devices; argent flows replay on Android when
  // their selectors match. The emulator must already be running.
  // android: { appPath: "/path/to/app-release.apk", applicationId: "com.example.app" },

  devices: ["iphone-6.9"],       // keys from $GOLDIE/src/specs.ts; "android-phone" for Google Play
  locales: ["en-US"],
  appearance: "light",           // simulator appearance for every capture

  // Bundled bezels: "17-pro-silver" | "17-pro-blue" | "17-pro-orange".
  // Pick the finish that contrasts with the background.
  frame: { variant: "17-pro-blue" },

  theme: {
    // Any CSS background. Soft brand-tinted gradients read best at store size.
    // "transparent" exports PNGs with alpha (for compositing; not uploadable as-is).
    background: "linear-gradient(160deg, #E8F1FF 0%, #F7FAFF 55%, #FFFFFF 100%)",
    headlineColor: "#0E1B2A",    // must contrast with the background;
    subheadColor: "#5A6A7D",     // light text on a dark background and vice versa
    // The system stack, or a bundled typeface named first: "Merriweather",
    // "DM Mono", "Lato", "DM Sans", "Montserrat" (files in $GOLDIE/assets/fonts).
    fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    copyHeightRatio: 0.24,       // fraction of frame height reserved for copy (classic layout)
    deviceWidthRatio: 0.84,      // fraction of frame width the bezel occupies (classic layout)
    template: "editorial",       // the strip's rhythm, see "Templates and layouts" below
    layout: "classic",           // layout for scenes the template leaves out
    // screenOnly: true,         // bare screens with a soft shadow instead of a bezel
    // decorations: [...],       // layers on every tile, see "Decorations" below
  },

  // Renders the realistic store page around the assets in the studio.
  store: {
    name: "AppName",
    subtitle: { "en-US": "Under 30 characters, Apple's limit" },
    developer: "Company Name",
    category: "Productivity",
    rating: 4.8,                 // cosmetic, studio only
    ratingCount: "1.2K Ratings",
    ageRating: "4+",
    price: "Free",
    description: { "en-US": "Two or three short paragraphs, store voice." },
  },

  // flowsDir: "../.argent/flows" by default, resolved from appRoot. Every
  // scene names a flow there, the way `argent flow run <name>` does.

  scenes: [
    // One entry per screenshot, in store-page order. The first two tiles are
    // what most visitors ever see, so lead with the strongest screens.
    {
      kind: "screenshot",
      id: "issues",
      flow: "store-01-issues",
      headline: { "en-US": "Every issue, one list" },
      subhead: { "en-US": "Grouped by status, sorted the way your team works." },
      // background: "..."     optional per-scene override
      // layout: "hero",        optional per-scene layout
      // secondScene: "detail", the second screen for duo / panorama-duo
      // decorations: [...],    layers on this tile only
    },
    // ... 3 or 4 more screenshot scenes ...

    // Exactly one preview scene. Each segment is its own flow and clip; the
    // clips are joined as recorded (Apple allows no bezel or captions).
    {
      kind: "preview",
      id: "preview",
      segments: [
        { id: "open",    flow: "store-preview-01-open" },
        { id: "compose", flow: "store-preview-02-compose" },
        { id: "create",  flow: "store-preview-03-create", holdSeconds: 2 },
      ],
    },
  ],
};

export default config;
```

Import the type with an absolute path to the goldie checkout, since the config
lives in the app repo.

## Templates and layouts

`theme.template` sets the layout of each screenshot in store order, so a
strip can mix a panorama, a hero, a tilted device and a breather. Use a
built-in key or a custom array of layout keys; a sequence shorter than the
scene list repeats. Built-ins:

| Template | Sequence |
|---|---|
| `editorial` | panorama, hero, offset, minimal, tilt |
| `showcase` | hero, tilt, duo, tilt-right, minimal |
| `magazine` | offset, copy-below, tilt-right, hero, minimal |
| `storyboard` | panorama-duo, copy-below, hero, minimal, tilt |
| `dynamic` | tilt, duo-tilt, panorama, minimal, tilt-right |

Precedence per scene: `scenes[].layout`, then the template's entry, then
`theme.layout`, then `classic`. Default to `editorial` for a 4 to 5 scene
strip, or write a sequence when the user describes the rhythm they want
("start with a panorama, then tilt the rest"). Layout keys, from
`$GOLDIE/src/layouts.ts`:

| Key | Composition | Needs |
|---|---|---|
| `classic` | centred copy above a centred device (default) | |
| `copy-below` | device hanging from the top, copy underneath | |
| `hero` | copy on top, large device running off the bottom | |
| `offset` | left-aligned copy, device pushed bottom right | |
| `tilt` | copy on top, device tilted off the bottom | |
| `tilt-right` | left-aligned copy, device tilted into the bottom right | |
| `duo` | two screens, the second smaller and behind | a second capture |
| `duo-tilt` | two tilted screens stepping diagonally | a second capture |
| `panorama` | two tiles, copy left, one big tilted device across the seam | takes 2 of the 10 slots |
| `panorama-duo` | two tiles sharing a headline, a screen each side | a second capture, 2 slots |
| `minimal` | no copy, a large centred device | |

Two-screen layouts borrow the next scene's capture unless the scene sets
`secondScene`. Choosing: lead with `classic`, `hero` or a `panorama` pair,
since the first two tiles are what most visitors see. Use `duo` with
`secondScene` for a list-and-detail pair. Keep tilted tiles to one in a row, and `minimal` for a
breather mid-strip. Panorama copy must read on the left tile alone.
`theme.screenOnly: true` removes the bezel in every layout.

## Decorations

Layers drawn over the background and under the device. `theme.decorations`
applies to every tile, `scenes[].decorations` to one; both stack.

```ts
{ kind: "badge", text: { "en-US": "Editors' Choice" }, position: "top-right",
  background: "#0E1B2A", color: "#FFFFFF" }          // colors optional
{ kind: "image", src: "art/sticker.png",              // relative to the config
  x: 0.7, y: 0.1, width: 0.25, rotate: 12 }           // fractions of the tile
```

## Writing the copy

- **Headlines**: 2 to 5 words, benefit-led, sentence case. Name what the user
  gets ("Find anything, fast"), never what the UI is ("Search screen").
- **Subheads**: one short sentence expanding the headline. Optional; drop it
  when the headline stands alone.
- **Badges**: two or three words at most ("Editors' Choice", "New in 2.0").
- Match the app's existing voice (website, onboarding text) when the repo
  shows one.

## Output

| Asset | Spec | Location |
|---|---|---|
| 6.9" screenshots | 1320x2868 PNG, no alpha | `out/screenshots/6.9/<locale>/` |
| 6.9" preview | 886x1920 H.264 30fps AAC, 15 to 30 s | `out/previews/6.9/<locale>/` |

`goldie verify` checks the finished files against these with `sips` and
`ffprobe` and fails on any mismatch.
