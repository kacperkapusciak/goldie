import type { GoldieConfig } from "./src/config.ts";

/**
 * Template. Copy to goldie.config.ts (here or in the app's own repo) and fill
 * in the app's values. Every relative path resolves against the config file,
 * and out/ is created next to it. Point goldie at a config in another
 * directory with the GOLDIE_CONFIG env var.
 *
 * Scene flows are argent flows: they live in the app repo's .argent/flows and
 * are named the way `argent flow run <name>` names them, so a flow recorded
 * with argent replays here unchanged. Set flowsDir to keep them elsewhere.
 */

const APP_ROOT = "/absolute/path/to/the/app/repo";

const config: GoldieConfig = {
  appRoot: APP_ROOT,
  // flowsDir: ".argent/flows" under appRoot by default.
  // Release simulator build. A Debug build needs Metro and paints LogBox
  // banners into the captures.
  appPath: `${process.env.HOME}/Library/Developer/Xcode/DerivedData/<App>-<hash>/Build/Products/Release-iphonesimulator/<App>.app`,
  bundleId: "com.example.app",
  // For the Google Play screenshots, start an emulator (emulator -avd <name>)
  // and point android at the release .apk; drop "pixel-10-pro" from devices
  // for an iOS-only run.
  // android: {
  //   appPath: "/path/to/app-release.apk",
  //   applicationId: "com.example.app",
  // },

  devices: ["iphone-6.9", "pixel-10-pro"], // keys from src/specs.ts; "ipad-13" for the 13" iPad
  locales: ["en-US"],
  appearance: "light",

  // Bundled bezel art for the screenshots: "17-pro-silver" | "17-pro-blue" |
  // "17-pro-orange" for the iPhone, "ipad-pro-13-silver" | "ipad-pro-13-space-gray"
  // for the iPad. One variant applies to its own device and the others keep their
  // first variant; frame: { variant: { "ipad-13": "ipad-pro-13-space-gray" } } sets
  // them per device. The android device is framed with the bundled Pixel 10 Pro
  // bezel. Custom art instead: frame: { image: "path/to/bezel.png" }
  // (re-measure src/frame.ts).
  frame: { variant: "17-pro-blue" },

  theme: {
    background: "linear-gradient(160deg, #E8F1FF 0%, #F7FAFF 55%, #FFFFFF 100%)",
    headlineColor: "#0E1B2A",
    subheadColor: "#5A6A7D",
    // System stack, or a bundled typeface first: "Merriweather", "DM Mono",
    // "Lato", "DM Sans", "Montserrat" (see src/fonts.ts).
    fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    copyHeightRatio: 0.24,
    deviceWidthRatio: 0.84,
    // The strip's rhythm: a built-in template ("editorial", "showcase",
    // "magazine", "storyboard", "dynamic") or your own sequence of layout keys
    // applied to the scenes in order. Layout keys, from src/layouts.ts:
    // "classic", "copy-below", "hero", "offset", "tilt", "tilt-right", "duo",
    // "duo-tilt", "panorama", "panorama-duo", "minimal".
    // template: ["panorama", "hero", "tilt", "minimal"],
    // Layout for every scene the template leaves out (or all, with no template).
    layout: "classic",
    // screenOnly: true,  bare screens with a shadow, no bezel
    // decorations: [{ kind: "badge", text: { "en-US": "Editors' Choice" }, position: "top-right" }],
  },

  // Renders the realistic store page around the assets in the studio.
  store: {
    name: "AppName",
    subtitle: { "en-US": "Under 30 characters" },
    developer: "Company Name",
    category: "Productivity",
    rating: 4.8, // cosmetic, studio only
    ratingCount: "1.2K Ratings",
    ageRating: "4+",
    price: "Free",
    description: { "en-US": "Two or three short paragraphs, store voice." },
  },

  scenes: [
    // One entry per screenshot, in store-page order. The flow navigates to the
    // screen; goldie takes the screenshot after its last step. Flow values are
    // argent flow names under .argent/flows (a path under it also works).
    {
      kind: "screenshot",
      id: "home",
      flow: "store-01-home",
      headline: { "en-US": "Benefit-led headline" },
      subhead: { "en-US": "One short sentence expanding the headline." },
      // layout: "hero",             this tile only
      // secondScene: "detail",      the second screen of a duo / panorama-duo layout
      // decorations: [{ kind: "image", src: "art/sticker.png", x: 0.7, y: 0.1, width: 0.25 }],
    },

    // One preview scene. Each segment is its own flow and clip; the clips are
    // joined as recorded, since Apple requires a plain screen recording (no
    // bezel or captions). Total video length must land between 15 and 30
    // seconds.
    {
      kind: "preview",
      id: "preview",
      segments: [
        {
          id: "open",
          flow: "store-preview-01-open",
        },
        {
          id: "act",
          flow: "store-preview-02-act",
          holdSeconds: 2,
        },
      ],
    },
  ],
};

export default config;
