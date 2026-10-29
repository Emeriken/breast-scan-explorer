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

/** Ram och text per poäng: 5 fylld, 4 svart ram, 3 grå, 1–2 dämpad. */
const TONE: Record<number, { box: string; off: string }> = {
  5: { box: "border-foreground bg-foreground text-background", off: "bg-background/30" },
  4: { box: "border-foreground text-foreground", off: "bg-input" },
  3: { box: "border-input text-ink-2", off: "bg-border" },
  2: { box: "border-border text-muted-foreground", off: "bg-border" },
  1: { box: "border-border text-muted-foreground", off: "bg-border" },
  0: { box: "border-border text-muted-foreground", off: "bg-border" },
};

export function roundScore(score: number) {
  return Math.max(0, Math.min(5, Math.round(score)));
}

/** Fem prickar där de fyllda visar poängen. Dekor: siffran bredvid bär informationen. */
export function ScoreDots({ score, className }: { score: number; className?: string }) {
  const n = roundScore(score);
  return (
    <span aria-hidden className={cn("inline-flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full", i <= n ? "bg-current" : TONE[n].off)}
        />
      ))}
    </span>
  );
}

/**
 * AI-relevans som "AI-relevans ●●●●○ 4". Siffran bär informationen, prickarna
 * och tonen gör att 4–5 syns först. `sm` utan ordet, för listor. Ett tryck
 * visar hela skalan med artikelns nivå markerad; `static` för exempel.
 */
export function ScoreBadge({
  score,
  size = "md",
  static: isStatic,
  className,
}: {
  score: number;
  size?: "md" | "sm";
  static?: boolean;
  className?: string;
}) {
  const n = roundScore(score);
  const badge = (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1.75 whitespace-nowrap rounded-sm border px-1.75 text-xs font-medium leading-4",
        // Skriv ut fyllnad och prickar som på skärmen, annars blir 5 vit text på vitt
        "[-webkit-print-color-adjust:exact] [print-color-adjust:exact]",
        TONE[n].box,
        isStatic && className,
      )}
    >
      {size === "md" && <span>AI-relevans</span>}
      <ScoreDots score={n} />
      <span className="font-bold tabular-nums">{n}</span>
      <span className="sr-only">{size === "md" ? " av 5" : " av 5 i AI-relevans"}</span>
    </span>
  );
  if (isStatic) return badge;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`AI-relevans ${n} av 5. Visa skalan`}
          className={cn(
            "hit-area inline-flex shrink-0 rounded-sm transition-opacity hover:opacity-80",
            className,
          )}
        >
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className="w-80 p-3 text-left"
      >
        <p className="text-xs font-semibold">AI-relevans {n} av 5</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Claude poängsätter varje artikel utifrån tidskrift, titel, MeSH-termer och abstract,
          enligt den här skalan:
        </p>
        <RubricList highlight={n} className="mt-2 text-muted-foreground" />
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          AI-genererat. Inte kliniskt beslutsstöd.
        </p>
      </PopoverContent>
    </Popover>
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
