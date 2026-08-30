/**
 * Store asset specifications.
 * iOS: App Store Connect, developer.apple.com/help/app-store-connect/reference/
 *   screenshot-specifications | app-preview-specifications. Verified 2026-08-24.
 * Android: Play Console help, "Add preview assets". Phone screenshots are
 *   PNG/JPEG, 16:9 or 9:16, each side 320-3840px for promotional eligibility.
 *   Play accepts no video uploads (the promo video is a YouTube link), which
 *   is why `preview` is null on android devices.
 */

export type DeviceKey = "iphone-6.9" | "android-phone";

export type DeviceSpec = {
  /** Human label used in output paths and logs. */
  label: string;
  platform: "ios" | "android";
  /**
   * `xcrun simctl` device type name; the toolkit picks the newest runtime that
   * has it. iOS only - android resolves a running emulator's adb serial instead.
   */
  simulatorName?: string;
  /**
   * Native capture resolution, portrait. null accepts the device's native
   * capture size as-is (Android emulators vary).
   */
  native: { width: number; height: number } | null;
  /** Required screenshot upload size, portrait. */
  screenshot: { width: number; height: number };
  /** Required app preview upload size, portrait. null: no app-preview video pipeline. */
  preview: { width: number; height: number } | null;
  /** Render bare screens with the drop shadow instead of a bezel. */
  screenOnly?: true;
  /** Render a drawn generic bezel: no licensed bezel art exists for this device. */
  drawnBezel?: true;
};

export const DEVICES: Record<DeviceKey, DeviceSpec> = {
  "iphone-6.9": {
    label: "6.9",
    platform: "ios",
    simulatorName: "iPhone 17 Pro Max",
    native: { width: 1320, height: 2868 },
    screenshot: { width: 1320, height: 2868 },
    preview: { width: 886, height: 1920 },
  },
  // No bundled Pixel bezel art (device-art licensing), so android renders a
  // drawn generic bezel regardless of the config's frame choice.
  "android-phone": {
    label: "play-phone",
    platform: "android",
    native: null,
    screenshot: { width: 1080, height: 1920 },
    preview: null,
    drawnBezel: true,
  },
};

/** Preview constraints Apple enforces at upload time. */
export const PREVIEW = {
  fps: 30,
  minSeconds: 15,
  maxSeconds: 30,
  /** Apple asks for 10-12 Mbps VBR on H.264. */
  videoBitrate: "11M",
  audioBitrate: "256k",
  audioSampleRate: 48000,
  maxBytes: 500 * 1024 * 1024,
} as const;

/** Screenshots may not carry an alpha channel. */
export const SCREENSHOT_PIXEL_FORMAT = "rgb24";
