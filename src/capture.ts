import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as argent from "./argent.ts";
import {
  flowPath,
  isPreview,
  isScreenshot,
  type LoadedConfig,
  type PreviewScene,
} from "./config.ts";
import * as device from "./device.ts";
import { imageSize } from "./image.ts";
import { FlowFailure } from "./repair.ts";
import { DEVICES, type DeviceKey } from "./specs.ts";

/**
 * A cold start after a reinstall can outrun argent's native-devtools handshake
 * on the `launch` step. The runner's own message says a re-run is the fix, so
 * one retry is built in rather than surfaced as a flow to repair.
 */
async function runFlow(path: string, udid: string) {
  const first = await argent.flow(path, udid);
  if (first.ok || first.failed?.kind !== "launch") return first;
  console.log("    launch raced the devtools handshake, retrying once");
  return argent.flow(path, udid);
}

/** What `frame`/`preview` read. Written to out/raw/<device>/manifest.json. */
export type CaptureManifest = {
  device: DeviceKey;
  udid: string;
  capturedAt: string;
  screenshots: Array<{ sceneId: string; file: string }>;
  preview: {
    sceneId: string;
    clips: Array<{ segmentId: string; file: string; durationSeconds: number }>;
  } | null;
};

export async function capture(cfg: LoadedConfig, deviceKey: DeviceKey): Promise<CaptureManifest> {
  const spec = DEVICES[deviceKey];
  const udid = await device.resolveUdid(deviceKey);
  const rawDir = join(cfg.outDir, "raw", deviceKey);
  await mkdir(rawDir, { recursive: true });

  const app = appFor(cfg, deviceKey);
  console.log(`> ${spec.simulatorName ?? spec.label} (${udid})`);
  await device.prepare(deviceKey, udid, cfg.locales[0]!, cfg.appearance);
  // A reinstall wipes app data, which is what makes a re-capture deterministic:
  // flows that create records start from the same empty state every run.
  await device.installApp(udid, app.path, app.id);
  // First launch after a reinstall pays for a cold JS bundle, which can outlast
  // the launch step's devtools handshake budget. Burn that cost here instead.
  await device.warmUp(udid, app.id);

  const manifest: CaptureManifest = {
    device: deviceKey,
    udid,
    capturedAt: new Date().toISOString(),
    screenshots: [],
    preview: null,
  };

  for (const scene of cfg.scenes.filter(isScreenshot)) {
    console.log(`  screenshot ${scene.id}`);
    const report = await runFlow(flowPath(cfg, scene.flow), udid);
    if (!report.ok) throw new FlowFailure(scene.id, flowPath(cfg, scene.flow), udid, report);

    // The flow runner pins and then restores the status bar around a run, so it
    // is re-pinned per capture rather than once at setup. The settle matters:
    // the runner's restore can land just after the flow reports done, and a
    // screenshot taken in that window catches a half-applied status bar - two
    // otherwise identical runs then differ by the wifi glyph alone.
    // Pinned twice with a settle between: the runner restores the status bar it
    // pinned for the run, and that restore can land after `argent flow run` has
    // already exited. A single pin loses that race often enough that two
    // otherwise identical runs differ by the wifi and battery glyphs alone.
    await device.pinStatusBar(deviceKey, udid);
    await sleep(800);
    await device.pinStatusBar(deviceKey, udid);
    await sleep(400);
    const file = join(rawDir, `${scene.id}.png`);
    await argent.runToFile("screenshot", { udid, scale: 1.0, includeImageInContext: false }, file);
    if (spec.native) {
      await assertSize(file, spec.native.width, spec.native.height);
    } else if (manifest.screenshots.length === 0) {
      // No fixed native size for this device (emulators vary); the renderer
      // cover-fits whatever comes back, so the size is informational.
      const got = await imageSize(file);
      console.log(`  capturing at ${got.width}x${got.height}`);
    }
    manifest.screenshots.push({ sceneId: scene.id, file });
  }

  const previewScene = cfg.scenes.find(isPreview);
  if (previewScene) {
    if (spec.preview) {
      manifest.preview = await captureSegments(cfg, previewScene, deviceKey, udid, rawDir, app.id);
    } else {
      console.log(`  ${deviceKey} has no preview pipeline; skipping segments`);
    }
  }

  await writeFile(join(rawDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** The build a device installs: the .app for iOS, the config's .apk for android. */
function appFor(cfg: LoadedConfig, deviceKey: DeviceKey): { path: string; id: string } {
  if (DEVICES[deviceKey].platform === "android") {
    if (!cfg.android) {
      throw new Error(
        `Device "${deviceKey}" needs the config's android block: ` +
          `android: { appPath: "<path to .apk>", applicationId: "<id>" }`,
      );
    }
    return { path: resolve(cfg.root, cfg.android.appPath), id: cfg.android.applicationId };
  }
  return { path: resolve(cfg.root, cfg.appPath), id: cfg.bundleId };
}

async function captureSegments(
  cfg: LoadedConfig,
  scene: PreviewScene,
  deviceKey: DeviceKey,
  udid: string,
  rawDir: string,
  appId: string,
): Promise<CaptureManifest["preview"]> {
  const clips: NonNullable<CaptureManifest["preview"]>["clips"] = [];

  // Segment flows are fragments that chain from the Issues list. Restarting
  // here rather than inside segment 1 keeps the cold-start frames - a blank
  // screen while the bundle loads - out of the recording.
  await argent.run("restart-app", { udid, bundleId: appId });
  await argent.run("await-screen-idle", { udid, timeoutMs: 60000 }).catch(() => {});

  for (const segment of scene.segments) {
    console.log(`  preview segment ${segment.id}`);
    const file = join(rawDir, `${scene.id}-${segment.id}.mp4`);

    await device.pinStatusBar(deviceKey, udid);
    // trimStatic and showTouches both default to true and both ruin a marketing
    // clip: trimming destroys real-time pacing, and the touch pulse is an overlay.
    await argent.run("screen-recording-start", {
      udid,
      timeLimitSeconds: 120,
      trimStatic: false,
      showTouches: false,
    });

    let failure: FlowFailure | null = null;
    let stopped: { video: string; durationMs: number } | null = null;
    try {
      const report = await runFlow(flowPath(cfg, segment.flow), udid);
      if (!report.ok)
        failure = new FlowFailure(
          `${scene.id}/${segment.id}`,
          flowPath(cfg, segment.flow),
          udid,
          report,
        );
      if (segment.holdSeconds) await sleep(segment.holdSeconds * 1000);
    } finally {
      // Stop even on failure, or the next segment cannot start a recording.
      // `--out` only handles image results, so the mp4 is copied off the path
      // the tool materialized it to.
      stopped = await argent.run<{ video: string; durationMs: number }>("screen-recording-stop", {
        udid,
      });
    }
    if (failure) throw failure;

    await copyFile(stopped!.video, file);
    clips.push({ segmentId: segment.id, file, durationSeconds: stopped!.durationMs / 1000 });
  }

  return { sceneId: scene.id, clips };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function assertSize(file: string, width: number, height: number): Promise<void> {
  const got = await imageSize(file);
  if (got.width !== width || got.height !== height) {
    throw new Error(
      `${file} is ${got.width}x${got.height}, expected ${width}x${height}. ` +
        `Either the simulator is not the device the spec names, or ARGENT_SCREENSHOT_SCALE is set.`,
    );
  }
}
