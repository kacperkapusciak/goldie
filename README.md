# Goldie: App Store screenshot generator for coding agents (and humans)

goldie makes App Store screenshots and app preview videos for an iOS app.
[argent](https://github.com/software-mansion/argent) replays flows on a
simulator; goldie frames the captures with a device bezel, background and
headline, joins the clips into a preview video, and checks the result against
Apple's upload rules.

goldie is framework agnostic. It drives the app through the simulator, so it
works the same for SwiftUI, UIKit, Flutter, React Native and Kotlin
Multiplatform apps.

## Install

You need macOS with iOS simulators, Node 20 or newer and ffmpeg.

Install the CLI:

```
npm i -g goldie
```

Add the skill to your coding agent:

```
npx skills add kacperkapusciak/goldie            # Cursor, Codex, any agent

/plugin marketplace add kacperkapusciak/goldie   # Claude Code
/plugin install goldie@goldie
```

The skill works with any agent that supports the skills format.

## Use with a coding agent

Ask from your app repo:

```
create App Store screenshots using goldie
```

The agent explores the app, writes the flows and config, and
opens the studio. Follow-ups such as `use a dark background` edit the same
files. 

## Use by hand

Copy `goldie.config.example.ts` to `goldie.config.ts`, point its scenes at
argent flows in `.argent/flows`, then:

```
goldie doctor     Check tools, simulators and flows
goldie all        Capture, frame, render the preview and verify
goldie studio     Preview and tweak the assets in the browser
```

Output lands in `out/`: 6.9" screenshots (1320 x 2868) and a 886 x 1920
H.264 preview, per locale. Previews must run 15 to 30 seconds.

## Google Play

Add the `android-phone` device key to render Google Play phone screenshots
(1080 x 1920) from the same scenes. Argent flows replay on Android too, so
the scene flows are shared; a flow works on both platforms when its selectors
match. The captures come from a running Android emulator - goldie does not
boot one, so start it first (`emulator -avd <name>`, list with
`emulator -list-avds`) and add the build to the config:

```ts
devices: ["iphone-6.9", "android-phone"],
android: {
  appPath: "/path/to/app-release.apk",
  applicationId: "com.example.app",
},
```

Android tiles render as bare screens with the drop shadow (`screenOnly`
rendering): no Pixel bezel art is bundled, to stay clear of device-art
licensing. No preview video is rendered for Play either - the Play Store's
promo video is a YouTube link, not an upload - so `preview` and `all` simply
skip it for this device.

## Design

https://github.com/user-attachments/assets/d6171a90-8fc1-437b-a574-5a8547068a3c

The studio switches backgrounds, templates, bezel, fonts and per-tile copy,
and saves to `goldie.design.json` so the CLI renders the same thing. The
config also takes:

- `frame`: `17-pro-blue`, `17-pro-silver`, `17-pro-orange`, or a custom
  bezel image; `theme.screenOnly: true` drops it.
- `theme.template`: `editorial`, `showcase`, `magazine`, `storyboard`,
  `dynamic`, or your own layout sequence from `classic`, `copy-below`, `hero`,
  `offset`, `tilt`, `tilt-right`, `duo`, `duo-tilt`, `panorama`,
  `panorama-duo`, `minimal`.
- `theme.fontFamily`: a CSS font stack. Merriweather, DM Mono, Lato, DM Sans
  and Montserrat are bundled.
- `decorations`: badges or images layered behind the device.

## Remarks

- Use a Release build; Debug builds paint LogBox banners into captures.
- Flows fail when the app changes. Ask coding agent to repair them, or re-record
  with argent.

## Sponsored by Software Mansion

goldie is sponsored by [Software Mansion](https://swmansion.com), the
software agency that created [Argent](https://github.com/software-mansion/argent).
You can [hire Software Mansion](https://swmansion.com/contact) for your next project.

<a href="https://swmansion.com"><img src="assets/software-mansion-logo-positive-s-left-top@1x.png" alt="Software Mansion" width="200" /></a>
