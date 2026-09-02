import {
  GalleryHorizontalIcon,
  LayoutGridIcon,
  type LucideIcon,
  MoonIcon,
  PlayIcon,
  SmartphoneIcon,
  SunIcon,
  TabletIcon,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SelectContent,
  SelectItem,
  Select as SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Platform } from "../App";
import type { StoreManifest } from "../manifest";
import { DesignPanel } from "./DesignPanel";
import { ExportPanel } from "./ExportPanel";
import type { StripView } from "./Strip";

/**
 * The device-type rows, in display order. An entry without a platform renders
 * disabled: iPad stays that way until goldie can capture iPads, which then
 * needs a platform of its own here and in the app's view state.
 */
const DEVICE_TYPES: Array<{
  key: string;
  icon: LucideIcon;
  label: string;
  platform?: Platform;
}> = [
  { key: "iphone", icon: SmartphoneIcon, label: "iPhone", platform: "ios" },
  { key: "ipad", icon: TabletIcon, label: "iPad" },
  { key: "android", icon: PlayIcon, label: "Android", platform: "android" },
];

/**
 * The left rail: the goldie wordmark with the view (one paged row or a
 * wrapping grid) and appearance toggles, what the strip shows (device and
 * locale, when there is a choice), the design controls, and a sticky Export
 * footer.
 */
export function Sidebar({
  manifest,
  platform,
  device,
  locale,
  dark,
  onPlatform,
  onDevice,
  onLocale,
  onDark,
  view,
  onView,
  background,
  frame,
  frames,
  fontFamily,
  template,
  layout,
  screenOnly,
  onBackground,
  onFrame,
  onFontFamily,
  onTemplate,
  onLayout,
  onScreenOnly,
}: {
  manifest: StoreManifest;
  platform: Platform;
  device: string;
  locale: string;
  dark: boolean;
  onPlatform: (v: Platform) => void;
  onDevice: (v: string) => void;
  onLocale: (v: string) => void;
  onDark: (v: boolean) => void;
  /** How the tiles are laid out on the stage. */
  view: StripView;
  onView: (v: StripView) => void;
  background: string;
  /** The bezel variant of the device on show, and every device's. */
  frame: string;
  frames: Record<string, string>;
  fontFamily: string;
  template: string;
  layout: string;
  screenOnly: boolean;
  onBackground: (v: string) => void;
  onFrame: (v: string) => void;
  onFontFamily: (v: string) => void;
  onTemplate: (v: string) => void;
  onLayout: (v: string) => void;
  onScreenOnly: (v: boolean) => void;
}) {
  const platformDevices = manifest.devices.filter((d) => d.platform === platform);
  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between pr-3 pl-5">
        <h1 className="text-base font-semibold tracking-tight select-none">
          <span className="goldie-wordmark">goldie</span>
        </h1>
        <div className="flex items-center gap-1">
          <Tabs value={view} onValueChange={(v) => onView(v === "grid" ? "grid" : "strip")}>
            <TabsList className="h-7 p-0.5" aria-label="Screenshot view">
              <TabsTrigger value="strip" className="px-1.5" aria-label="Strip view" title="Strip">
                <GalleryHorizontalIcon aria-hidden />
              </TabsTrigger>
              <TabsTrigger value="grid" className="px-1.5" aria-label="Grid view" title="Grid">
                <LayoutGridIcon aria-hidden />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDark(!dark)}
            aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <div className="sidebar-scroll flex-1 overflow-y-auto">
        {/* Both stores always show, so an iOS-only setup still surfaces that
            Google Play screenshots exist (and vice versa). */}
        <RadioGroupPrimitive.Root
          value={platform === "ios" ? "iphone" : "android"}
          onValueChange={(key) => {
            const picked = DEVICE_TYPES.find((t) => t.key === key)?.platform;
            if (picked) onPlatform(picked);
          }}
          aria-label="Device type"
          className="grid grid-cols-3 gap-2 px-5 pt-4"
        >
          {DEVICE_TYPES.map(({ key, icon: Icon, label, platform: target }) => (
            <RadioGroupPrimitive.Item
              key={key}
              value={key}
              disabled={!target}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-lg border border-transparent px-1 py-2.5 text-xs font-medium text-muted-foreground transition-colors",
                "hover:not-data-[state=checked]:bg-muted/60 hover:text-foreground",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                "data-[state=checked]:border-border data-[state=checked]:bg-muted data-[state=checked]:text-foreground",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{label}</span>
              {target ? null : (
                <span className="absolute top-1 right-1.5 text-[9px] font-normal text-muted-foreground/70">
                  Soon
                </span>
              )}
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
        {platformDevices.length > 1 || manifest.locales.length > 1 ? (
          <div className="flex flex-col gap-4 p-5">
            {platformDevices.length > 1 ? (
              <Field label="Device">
                <Select
                  value={device}
                  onChange={onDevice}
                  options={platformDevices.map((d) => [
                    d.key,
                    d.platform === "ios" ? `${d.label}"` : d.label,
                  ])}
                />
              </Field>
            ) : null}
            {manifest.locales.length > 1 ? (
              <Field label="Locale">
                <Select
                  value={locale}
                  onChange={onLocale}
                  options={manifest.locales.map((l) => [l, l])}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
        <DesignPanel
          design={manifest.design}
          device={device}
          deviceFrame={
            platform === "android" || Boolean(platformDevices.find((d) => d.key === device)?.frame)
          }
          background={background}
          frame={frame}
          fontFamily={fontFamily}
          template={template}
          layout={layout}
          screenOnly={screenOnly}
          onBackground={onBackground}
          onFrame={onFrame}
          onFontFamily={onFontFamily}
          onTemplate={onTemplate}
          onLayout={onLayout}
          onScreenOnly={onScreenOnly}
        />
      </div>

      <footer className="shrink-0 bg-sidebar p-4">
        <ExportPanel
          background={background}
          frames={frames}
          font={fontKey(manifest.design, fontFamily)}
          template={template}
          layout={layout}
          screenOnly={screenOnly}
        />
      </footer>
    </aside>
  );
}

/**
 * The CLI's --font key for the current font stack: a bundled font's key when
 * the stack names its family, "system" when it is the config's own stack
 * (the CLI then leaves theme.fontFamily alone), else undefined.
 */
function fontKey(design: StoreManifest["design"], fontFamily: string): string | undefined {
  if (fontFamily === design.theme.fontFamily) return undefined;
  return design.fonts.find((f) => fontFamily.startsWith(`"${f.family}"`))?.key ?? "system";
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {hint ? <span className="text-[11px] text-muted-foreground/70">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Radix Select treats "" as "no value", so the custom-frame option (an empty
 * slug) rides on a sentinel that is mapped back on change.
 */
const EMPTY = "__none__";

export function Select({
  value,
  onChange,
  options,
  size = "default",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <SelectRoot value={value || EMPTY} onValueChange={(v) => onChange(v === EMPTY ? "" : v)}>
      <SelectTrigger size={size} className={className ?? "w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v || EMPTY}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
