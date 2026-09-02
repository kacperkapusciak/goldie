---
name: goldie
description: >-
  Create App Store and Play Store screenshots and preview videos for an iOS
  or Android app. goldie explores the app on a simulator or emulator, writes
  argent flows, renders framed screenshots and a preview video, and opens a
  local studio with the finished store page. Use this skill when the user
  asks for store screenshots, store assets, a preview video, or mentions
  goldie. Also use it to change assets goldie made before: new headlines, a
  different background or bezel, or a new screenshot order. Run it from the
  mobile app's repo.
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

## Step 0: Settle which stores to target

Which stores are in play follows from what the repo can build, so look before
asking. Check for an iOS target (an `.xcodeproj` / `.xcworkspace`, a Swift
package with an app target, an `ios/` directory) and an Android target (a
`build.gradle[.kts]` with an application module, an `android/` directory).

- **Single-platform repo** — native Android only, or iOS/Swift only. There is
  one possible answer, so do not ask: target that store and say which one you
  picked and why in your first message.
- **Cross-platform repo** — React Native, Expo, Flutter, Kotlin Multiplatform,
  or anything else with both an iOS and an Android target. Always ask before
  doing anything else, even when the user already named one platform: a prompt
  that says "Play Store screenshots" often still means "and the App Store
  too", and the answer decides work that is expensive to redo. If an
  interactive question tool is available (such as AskUserQuestion in Claude
  Code), use it with multiple selections allowed, preselecting or leading with
  whatever the user named; otherwise ask in chat and let the user pick one or
  both.

The two options:

- **Apple App Store (iPhone)**: framed iPhone screenshots and an app preview
  video, captured on an iOS simulator.
- **Google Play Store (Android)**: Play phone screenshots captured on an
  Android emulator, plus a portrait preview video; the Play promo video is
  a YouTube link, so the user posts the video there themselves.

Both can be selected; scenes and flows are shared across stores. The answer
decides which device keys go in the config, which builds Step 1 must find
(iOS simulator build, Android APK, or both), and whether the Google Play
section below applies. On a follow-up to an existing setup, the config's
devices already answer this, so do not ask again.

## Step 0.5: Make sure goldie runs

goldie is an npm package that bundles the CLI, the studio and a pinned argent
driver. Nothing needs cloning; `npx` fetches it on first use:

```bash
npx -y goldie@0 help
```

Every command below is `npx -y goldie@0 <cmd>`, referred to as `goldie`.
It needs Node 20+ and `ffmpeg` on the PATH (`brew install ffmpeg` on macOS,
`winget install ffmpeg` on Windows, `apt install ffmpeg` on Linux). iOS
devices need a macOS host; on Linux and Windows only the Android device
(`pixel-10-pro`) can run, so leave the iOS keys out of `devices` there. If
`$GOLDIE_ROOT` is set, the user is working from a source checkout; run
`bun $GOLDIE_ROOT/src/cli.ts <cmd>` instead. All app-specific files live in
the app repo.

goldie knows three devices: `iphone-6.9` (iPhone 17 Pro Max, the App Store's
required size), `ipad-13` (iPad Pro 13-inch, for apps that also ship on
iPad), and `pixel-10-pro` (the Google Play phone). All replay the same flows
and share the copy, theme and template; each has its own bezels, raw
captures, output folder and studio view.

## Step 1: Gather app facts

What to look for depends on the stores chosen in Step 0.

- **App name and identifier.** iOS: the Xcode project, `app.json` /
  `app.config.*` (Expo), or `Info.plist`. Android: `applicationId` in
  `app/build.gradle[.kts]`, or the Expo config's `android.package`.
- **An iOS Release simulator build** (App Store only). Look for the newest
  `~/Library/Developer/Xcode/DerivedData/<App>-*/Build/Products/Release-iphonesimulator/<App>.app`.
  If only Debug exists, build Release: a Debug build needs Metro and paints
  LogBox banners into the captures, so it makes unusable marketing assets.
- **An Android APK** (Google Play only). A release APK is best; build it with
  the repo's own scripts or `./gradlew :app:assembleRelease`, and note that an
  unsigned release APK will not install. A debug APK is acceptable for a
  native Android app, which paints no debug overlay; for React Native, a debug
  APK needs Metro and shows the dev overlay, so build release there.

Use the repo's own build scripts whenever it has them.

## Step 2: Explore the app and choose the scenes

Use argent MCP tools to see the app before deciding anything. Boot the device
for the store you are targeting: an iPhone 16 Pro Max class simulator for the
App Store, a Pixel 10 Pro (or Pixel 9 Pro) AVD for Google Play. Install the
build, launch it, and walk the main screens with `describe` and `screenshot`.
Also check the app repo for existing recorded flows in `.argent/flows/`; they
are the best source of working selectors and coordinates. If the app ships on
iPad too (`supportsTablet` in an Expo config, or an iPad target), plan on
adding `"ipad-13"` to `devices` and check the same screens on an "iPad Pro
13-inch (M4)" simulator. Whenever more than one device is targeted, the flows
must use selectors that hold on every layout, so prefer `text:` and `id:`
over coordinates.

Choose:

- **4 or 5 screenshot scenes.** Each is one screen that sells a feature: the
  main list, a detail view, search, a distinctive feature screen. Prefer
  screens with real-looking content.
- **A 3 or 4 segment preview story.** One short user journey told in order,
  for example: see the main screen, start a core action, complete it, see the
  result. Each segment becomes one clip. The clips are joined with no captions
  or framing, so each step must read on its own. For the App Store the total
  video must land between 15 and 30 seconds. Google Play takes a YouTube link
  instead of an upload, so the Android video is rendered for the user to post
  themselves and has no duration bounds; when both stores are targeted, aim
  for the Apple window.

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

The `pixel-10-pro` device key renders Play phone screenshots (1080 x 1920)
from the same scenes: scenes and flows are shared across devices, and argent
flows replay on Android when their selectors match. Add the config's
`android: { appPath: "<apk>", applicationId: "<id>" }` block, make sure an
AVD with the Pixel 10 Pro or Pixel 9 Pro hardware profile exists (same
screen; goldie reuses a running emulator or boots the AVD itself), then run
the same capture/frame commands. Android tiles are framed with the bundled
Pixel 10 Pro bezel instead of the config's `frame` variant (iPhone art);
`android.frame` replaces it with your own art. Play takes no video uploads
(the promo video is a YouTube link), so `preview` renders a 1080x2400
portrait video for the user to post on YouTube themselves; no duration
bounds apply to it.

## Iterating on an existing setup

A follow-up prompt maps onto a small change in the config or a flow, then
the cheapest stage that reflects it. Do not re-explore the app or rewrite
scenes the user did not mention. Report which file and field you changed so
the next prompt can build on it.

| The user asks for | Edit | Then run |
|---|---|---|
| Different headline, subhead or store copy | `scenes[].headline` / `subhead`, `store.*` | `frame`, `manifest` |
| A new look: background, text colors, font, sizing | `theme.*`, or `scenes[].background` for one tile | `frame`, `manifest` |
| A different bezel, or no bezel | `frame.variant` (one variant, or one per device key), `theme.screenOnly` | `frame`, `manifest` |
| iPad screenshots as well | `devices: ["iphone-6.9", "ipad-13"]`, `frame.variant["ipad-13"]` | `capture --device ipad-13`, `frame`, `preview`, `manifest` |
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

