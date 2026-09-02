import { CheckIcon, CopyIcon, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Centered stage placeholder for the states where the strip has nothing to
 * composite: assets not generated, a platform not configured, a device not
 * captured yet. Each names the next CLI step in a copyable command chip.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  command,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  command?: string;
}) {
  return (
    <div className="grid h-full place-items-center px-10 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-xs">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {body ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
        ) : null}
        {command ? <CommandChip command={command} /> : null}
      </div>
    </div>
  );
}

/** The command to run next, with a copy button that flashes a check. */
function CommandChip({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-border bg-background py-1 pr-1 pl-3 shadow-xs">
      <code className="font-mono text-xs text-foreground">{command}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy command"}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </Button>
    </div>
  );
}
