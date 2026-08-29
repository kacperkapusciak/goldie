---
name: goldie
description: >-
  Create App Store screenshots and app preview videos for an iOS app with the
  goldie toolkit: explore the app on a simulator, author argent flows for its
  key user flows, render framed screenshots and a plain preview video, and open a local
  studio showing the finished store page. Use this whenever the user asks
  for App Store or Google Play screenshots, store assets, marketing
  screenshots, an app preview video, or mentions goldie, even if they only say
  something like "make screenshots for the store" or "I need App Store assets
  for this app".
  Also use it for follow-ups on assets goldie already made: new headlines, a
  different background or bezel, swapping or reordering a screenshot, or a
  changed preview story. Run it from inside the mobile app's repo.
---

# goldie: App Store assets for the app in this repo

goldie replays argent YAML flows on an iOS simulator, captures raw screenshots
and recordings, and turns them into upload-ready assets: screenshots get a
device bezel, a background, and marketing copy; the preview video is the raw
recordings joined as-is, since Apple requires app previews to be a plain
screen recording with no framing or captions. A React studio shows the
result as the real store page. Your job is everything goldie cannot do alone:
pick the screens worth marketing, author the flows that reach them, write the
copy, and drive the pipeline.

The end state: 4 or 5 framed screenshots and the raw clips for a preview video,
visible in the studio at http://localhost:4321, with the video rendering in
the background.

## Before anything: check for an existing goldie setup

goldie keeps the whole outcome in files the user can re-prompt against. If
the app repo already has a config, this is a follow-up, so read it first and
skip to "Iterating on an existing setup" below rather than starting over:

```bash
ls goldie/goldie.config.ts .argent/flows/ 2>/dev/null; echo "GOLDIE_CONFIG=$GOLDIE_CONFIG"
```

Read `goldie/goldie.config.ts` in full and the flows it names. Together they
are the source of truth for every visible choice: which screens, in what
order, the headlines and subheads, the background and copy colors, the bezel,
the store listing, and the preview story. Nothing lives only in your head or
in the studio, so a user who says "make it darker" or "swap the search
screenshot for settings" is asking for an edit to those files.

## Step 0: Make sure goldie runs

goldie is an npm package that bundles the CLI, the studio and a pinned argent
driver. Nothing needs cloning; `npx` fetches it on first use:

```bash
npx -y goldie@0 help
```

Every command below is `npx -y goldie@0 <cmd>`, referred to as `goldie`.
It needs Node 20+ and `ffmpeg` on the PATH (`brew install ffmpeg`). If
`$GOLDIE_ROOT` is set, the user is working from a source checkout; run
`bun $GOLDIE_ROOT/src/cli.ts <cmd>` instead. All app-specific files live in
the app repo.

## Step 1: Gather app facts

From the app repo, find:

- **App name and bundle id.** Look in the Xcode project, `app.json` /
  `app.config.*` (Expo), or `Info.plist`.
- **A Release simulator build.** Look for the newest
  `~/Library/Developer/Xcode/DerivedData/<App>-*/Build/Products/Release-iphonesimulator/<App>.app`.
  If only Debug exists, build Release: a Debug build needs Metro and paints
  LogBox banners into the captures, so it makes unusable marketing assets.
  Use the repo's own build scripts if it has them.

## Step 2: Explore the app and choose the scenes

Use argent MCP tools to see the app before deciding anything. Boot an iPhone
16 Pro Max class simulator, install the Release build, launch it, and walk the
main screens with `describe` and `screenshot`. Also check the app repo for
existing recorded flows in `.argent/flows/`; they are the best source of
working selectors and coordinates.

Choose:

- **4 or 5 screenshot scenes.** Each is one screen that sells a feature: the
  main list, a detail view, search, a distinctive feature screen. Prefer
  screens with real-looking content.
- **A 3 or 4 segment preview story.** One short user journey told in order,
  for example: see the main screen, start a core action, complete it, see the
  result. Each segment becomes one clip. The clips are joined with no
  captions or framing, so each step must read on its own, and the total video
  must land between 15 and 30 seconds.

While exploring, note the exact visible text labels and accessibility ids you
will need as selectors, and normalized coordinates for anything with no label
(icon-only tab bars are the usual case).

## Step 3: Author the config and flows

The flows are argent flows and belong in the app's own flow store, next to any
flow already recorded there. The config sits in a `goldie/` directory:

```
<app-repo>/
├── .argent/flows/
│   ├── store-01-<scene>.yaml ...        one per screenshot scene
│   └── store-preview-01-<segment>.yaml  one per preview segment
└── goldie/goldie.config.ts
```

A scene names its flow the way `argent flow run <name>` does: `flow:
"store-01-home"` runs `.argent/flows/store-01-home.yaml`. Prefix the marketing
flows so they read apart from the app's test flows, and reuse an existing flow
by name when one already reaches the screen. `flowsDir` in the config overrides
the location; the default is `.argent/flows` under `appRoot`.

Read `references/config.md` for the config schema, an annotated example, and
copywriting guidance. Read `references/flows.md` for the flow YAML vocabulary
and the conventions that keep flows replayable. Write the headlines and
subheads yourself in the app's voice; they are the marketing layer, so make
them benefit-led and short.

Everything renders relative to the config file: output lands in
`<app-repo>/goldie/out/`. Add `goldie/out/` to the app's `.gitignore`, and
commit `goldie.config.ts` and the flows.

Because they are plain argent flows, each one is runnable on its own with
`argent flow run store-01-home` from the app repo, which is the fastest way to
check a flow before a full capture.

## Step 4: Doctor, then capture

Every goldie command reads the config path from the `GOLDIE_CONFIG` env var.
Shell state does not persist between your Bash calls, so prefix every goldie
command with it:

```bash
GOLDIE_CONFIG=<app-repo>/goldie/goldie.config.ts npx -y goldie@0 doctor
```

Fix everything doctor flags before capturing. The usual findings and their
fixes are in the Gotchas section of goldie's README; the common ones are the
argent video watermark flag, a screenshot scale override, and a Debug build.

Then capture and render the stills (skip the video for now, it takes minutes):

```bash
GOLDIE_CONFIG=... npx -y goldie@0 capture
GOLDIE_CONFIG=... npx -y goldie@0 frame
GOLDIE_CONFIG=... npx -y goldie@0 manifest
```

`capture` replays every flow, including the preview segments, so the raw clips
exist for the lazy video render later.

### When a flow breaks

Flows replay with no LLM, so a wrong selector fails loudly. goldie prints the
failed step and argent's reason. Fix it over argent MCP: `describe` the live
screen to find the real label or id, correct the YAML, and re-run capture.
Prefer `text:` and `id:` selectors; when only a coordinate works, add an
`echo:` step above it explaining what it points at, so the next repair knows
what to re-resolve.

## Step 5: Open the studio, render the video lazily

Start the studio in the background. It needs `GOLDIE_CONFIG` too, so it
serves the app repo's `out/`:

```bash
GOLDIE_CONFIG=... npx -y goldie@0 studio --no-open   # background task; serves http://localhost:4321
```

Tell the user it is up at http://localhost:4321. Then, also in the background,
render the preview video so it appears on reload once done:

```bash
GOLDIE_CONFIG=... npx -y goldie@0 preview && GOLDIE_CONFIG=... npx -y goldie@0 manifest
```

If `preview` refuses because the total is outside 15 to 30 seconds, adjust
segment pacing (`wait:` steps and `holdSeconds`) and re-capture only what
changed.

Finish with `GOLDIE_CONFIG=... npx -y goldie@0 verify` and report the result: which
assets exist, where they are, and whether they pass Apple's rules. The
studio's sidebar shows the same checks; a red row is a rule violation. The
Design panel lets the user restyle backgrounds, layouts, bezels and fonts
without you, and Export downloads an upload-ready zip.

## Google Play

The `android-phone` device key renders Play phone screenshots (1080 x 1920)
from the same scenes: scenes and flows are shared across devices, and argent
flows replay on Android when their selectors match. Add the config's
`android: { appPath: "<apk>", applicationId: "<id>" }` block, start an
emulator first (`emulator -avd <name>`; goldie does not boot one), then run
the same capture/frame commands. Android tiles render screen-only (no bundled
bezel art), and no preview video exists for Play - the promo video is a
YouTube link - so `preview` skips the device.

## Iterating on an existing setup

A follow-up prompt maps onto a small change in the config or a flow, then
the cheapest stage that reflects it. Do not re-explore the app or rewrite
scenes the user did not mention. Report which file and field you changed so
the next prompt can build on it.

| The user asks for | Edit | Then run |
|---|---|---|
| Different headline, subhead or store copy | `scenes[].headline` / `subhead`, `store.*` | `frame`, `manifest` |
| A new look: background, text colors, font, sizing | `theme.*`, or `scenes[].background` for one tile | `frame`, `manifest` |
| A different bezel, or no bezel | `frame.variant`, `theme.screenOnly` | `frame`, `manifest` |
| A varied strip: panorama opener, hero, tilted tiles, a breather | `theme.template`: a built-in key or a sequence of layout keys (see `references/config.md`) | `frame`, `manifest` |
| A different layout for every tile, or one | `theme.layout`, or `scenes[].layout` for one tile | `frame`, `manifest` |
| Two screens in one tile, or a two-tile panorama | `scenes[].layout: "duo"` / `"panorama-duo"` plus `secondScene`, or `"panorama"` | `frame`, `manifest` |
| A badge, sticker or logo on the tiles | `theme.decorations` (all) or `scenes[].decorations` (one) | `frame`, `manifest` |
| Dark mode captures | `appearance: "dark"` (and text colors to match) | `capture`, `frame`, `manifest` |
| Reorder, drop or add a screenshot | `scenes[]`; a new scene needs a new flow in `.argent/flows` | `capture` (new flows), `frame`, `manifest` |
| Show a different state on one screen | the scene's flow YAML | `capture`, `frame`, `manifest` |
| Change the preview story or its pacing | preview `segments[]`, `holdSeconds`, flow `wait:` steps | `capture`, `preview`, `manifest` |
| Another locale | `locales`, plus a `<locale>` key in every copy record | `capture`, `frame`, `preview`, `manifest` |

`capture` replays every flow; to re-capture only what changed, keep the
other scenes as they are and accept the extra minute, or delete only the
stale files under `out/raw/` before running it. `frame` and `manifest` take
seconds, so run them freely. The studio at http://localhost:4321 picks up
changes on reload; start it again with `GOLDIE_CONFIG` if it is not running.

The studio's Design panel writes to `goldie.design.json` next to the config,
and the CLI's `--background` / `--frame` / `--font` / `--template` /
`--layout` / `--screen-only` flags are one-run overrides; neither touches the
config. If the user tried something there and wants to keep it, copy the
value into `theme.background`, `frame.variant`, `theme.fontFamily`,
`theme.template`, `theme.layout` or `scenes[].layout` so the next re-prompt
starts from what they see. The
current on-disk values are also in `goldie/out/web/store.json` under `design`,
which is the fastest way to confirm what the studio is showing right now.

