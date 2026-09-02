import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CUSTOM_TEMPLATE } from "../App";

/**
 * The one place the goldie CLI runs: Export re-renders the screenshots and
 * the preview video from the raw captures with the current design, zips them,
 * and hands the browser the zip. Streams the CLI log while it runs (the video
 * render takes a while). Served by `goldie studio` and the Vite dev server alike (src/studio-server.ts).
 */
export function ExportPanel({
  background,
  frames,
  font,
  template,
  layout,
  screenOnly,
}: {
  background: string;
  /** Bezel variant per device key; empty values mean the config's custom art. */
  frames: Record<string, string>;
  /** A --font key, or undefined to keep the config's font. */
  font: string | undefined;
  /** A built-in template key, "" for none, or the custom sentinel (left to the sidecar/config). */
  template: string;
  layout: string;
  screenOnly: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the log text changes
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [log]);

  async function exportZip() {
    if (busy) return;
    setBusy(true);
    setLog("");
    let text = "";
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          background,
          frames,
          font,
          template: template === CUSTOM_TEMPLATE ? undefined : template || "none",
          layout,
          screenOnly,
        }),
      });
      if (!res.ok || !res.body) {
        setLog(`${res.status}: ${await res.text()}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setLog(text);
      }
      if (text.includes("[done]")) {
        setLog(null);
        const a = document.createElement("a");
        a.href = "/api/export/download";
        a.download = "";
        a.click();
      }
    } catch (err) {
      setLog(`${text}\n${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {log !== null && !busy ? (
        <p className="text-[12px] text-destructive">Export failed.</p>
      ) : null}

      {log !== null ? (
        <pre
          ref={logRef}
          className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground"
        >
          {log || "Starting…"}
        </pre>
      ) : null}

      <Button size="lg" className="w-full" onClick={() => void exportZip()} disabled={busy}>
        {busy ? (
          <>
            <Loader2Icon className="animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <DownloadIcon />
            Export screenshots
          </>
        )}
      </Button>
    </div>
  );
}
