import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T> = { value: T; label: string; title?: string };

/**
 * Knappgrupp där ett alternativ är valt. `inline` lägger etiketten i gruppen
 * (kompakt verktygsrad), annars står den ovanför.
 */
export function Segmented<T extends string | number | undefined>({
  label,
  value,
  options,
  onChange,
  info,
  fill,
  inline,
  className,
}: {
  label: string;
  value: T | "__none__";
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  info?: ReactNode;
  fill?: boolean;
  inline?: boolean;
  className?: string;
}) {
  const group = (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-border bg-background p-0.5",
        fill && "flex w-full",
      )}
    >
      {inline && (
        <span className="flex items-center gap-1 whitespace-nowrap pl-2 pr-1.5 text-xs font-medium text-muted-foreground">
          {label}
          {info}
        </span>
      )}
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "hit-area h-full whitespace-nowrap rounded-[5px] px-3 text-xs font-medium transition-colors",
              fill && "flex-1 px-2",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
  if (inline) return <div className={className}>{group}</div>;
  return (
    <div className={cn("flex flex-col gap-1", fill && "w-full", className)}>
      <span className="flex h-6 items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {info}
      </span>
      {group}
    </div>
  );
}
