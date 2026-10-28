import { List, Rows2, type LucideIcon } from "lucide-react";
import type { ListView } from "@/lib/list-view";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ListView; label: string; Icon: LucideIcon }[] = [
  { value: "kort", label: "Kort", Icon: Rows2 },
  { value: "lista", label: "Lista", Icon: List },
];

/** Växla mellan kort och lista. På mobil bara ikoner, med namnet för skärmläsare. */
export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: ListView;
  onChange: (v: ListView) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Visning"
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-md border border-input bg-card p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={value === "kort" ? "Visa som kort" : "Visa som lista"}
            onClick={() => onChange(value)}
            className={cn(
              "hit-area inline-flex h-full w-9 items-center justify-center gap-1.5 rounded-sm text-meta transition-colors sm:w-auto sm:px-2.5",
              active
                ? "bg-muted font-semibold text-foreground"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
