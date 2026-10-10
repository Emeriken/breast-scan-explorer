import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Kryssrutor för flerval, med valfri förklaring under varje alternativ. */
export function CheckboxList({
  options,
  selected,
  onChange,
  descriptions,
  className,
}: {
  options: string[];
  selected: string[];
  onChange: (s: string[]) => void;
  descriptions?: Record<string, string>;
  className?: string;
}) {
  const selectedSet = new Set(selected);
  const toggle = (v: string) => {
    const next = new Set(selectedSet);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(options.filter((o) => next.has(o)));
  };
  if (options.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">Inga val tillgängliga</p>;
  }
  return (
    <div className={className}>
      {options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
        >
          <Checkbox
            className="mt-0.5"
            checked={selectedSet.has(opt)}
            onCheckedChange={() => toggle(opt)}
          />
          <span className="min-w-0">
            <span className="block">{opt}</span>
            {descriptions?.[opt] && (
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {descriptions[opt]}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  fill,
  inline,
  descriptions,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (s: string[]) => void;
  fill?: boolean;
  /** Etiketten i knappen ("Kategori: Alla") i stället för ovanför */
  inline?: boolean;
  descriptions?: Record<string, string>;
}) {
  const summary =
    selected.length === 0
      ? "Alla"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} valda`;
  const trigger = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`${label}: ${summary}`}
          className={cn(
            "h-9 justify-between gap-2 font-normal",
            inline ? "max-w-[15rem]" : "min-w-[9rem]",
            fill && "w-full max-w-none",
            selected.length > 0 && "border-foreground/40",
          )}
        >
          <span className="truncate">
            {inline && <span className="text-muted-foreground">{label}: </span>}
            {summary}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", descriptions ? "w-[min(24rem,calc(100vw-2rem))]" : "w-72")}
        align="start"
        collisionPadding={16}
      >
        <CheckboxList
          className="max-h-[min(24rem,60vh)] overflow-y-auto p-2"
          options={options}
          selected={selected}
          onChange={onChange}
          descriptions={descriptions}
        />
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Rensa {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
  if (inline) return trigger;
  return (
    <div className={cn("flex flex-col gap-1", fill && "w-full")}>
      <span className="flex h-6 items-center text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {trigger}
    </div>
  );
}
