import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Skalan som AI:n poängsätter efter, ordagrant från instruktionen i
 * pubmed-bevaknng/scripts/screen.py (SCORING_SYSTEM_PROMPT). Ändras skalan
 * där ska den ändras här.
 */
export const RUBRIC: { score: number; text: string }[] = [
  {
    score: 5,
    text: "Praxisförändrande eller stort genomslag (fas III, viktiga riktlinjer, paradigmskifte)",
  },
  {
    score: 4,
    text: "Mycket viktig (välgjord fas II, viktiga mekanistiska fynd, viktiga metaanalyser)",
  },
  { score: 3, text: "Relevant och värd att läsa" },
  { score: 2, text: "Mindre relevant, smal nisch eller preliminära data" },
  {
    score: 1,
    text: "Marginellt relevant (t.ex. case report, kort kommentar, endast tangerar bröstcancer)",
  },
];

const TONE: Record<number, string> = {
  5: "border-foreground bg-foreground text-background",
  4: "border-foreground/70 text-foreground",
  3: "border-border text-foreground/85",
  2: "border-border/70 text-muted-foreground",
  1: "border-border/70 text-muted-foreground",
  0: "border-border/70 text-muted-foreground",
};

export function roundScore(score: number) {
  return Math.max(0, Math.min(5, Math.round(score)));
}

/**
 * AI-relevans som text, t.ex. "AI-relevans 4/5". Tonen följer poängen så att
 * 4–5 syns först, men siffran bär alltid informationen.
 */
export function ScoreBadge({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "md" | "sm";
  className?: string;
}) {
  const n = roundScore(score);
  const rubric = RUBRIC.find((r) => r.score === n)?.text;
  return (
    <span
      title={rubric ? `AI-relevans ${n} av 5: ${rubric}` : `AI-relevans ${n} av 5`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-xs leading-5",
        TONE[n],
        className,
      )}
    >
      {size === "md" && <span className={n >= 5 ? "" : "opacity-80"}>AI-relevans</span>}
      <span className="font-semibold tabular-nums">
        {n}
        <span className="font-normal opacity-70">/5</span>
      </span>
      {size === "sm" && <span className="sr-only"> i AI-relevans</span>}
    </span>
  );
}

/** Skalan som lista, för förklaringar. */
export function RubricList({ highlight, className }: { highlight?: number; className?: string }) {
  return (
    <ol className={cn("space-y-1 text-xs leading-relaxed", className)}>
      {RUBRIC.map((r) => (
        <li
          key={r.score}
          className={cn(
            "grid grid-cols-[1.25rem_1fr] gap-1",
            highlight === r.score && "font-semibold text-foreground",
          )}
        >
          <span className="tabular-nums">{r.score}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Info-knapp med skalan, bredvid filtret för AI-relevans. */
export function RelevanceInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Om AI-relevans"
          className="hit-area inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className="w-80 p-3 text-left"
      >
        <p className="text-xs font-semibold uppercase tracking-wide">AI-relevans 1–5</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Claude poängsätter varje artikel utifrån tidskrift, titel, MeSH-termer och abstract,
          enligt den här skalan:
        </p>
        <RubricList className="mt-2" />
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          AI-genererat. Inte kliniskt beslutsstöd.
        </p>
      </PopoverContent>
    </Popover>
  );
}
