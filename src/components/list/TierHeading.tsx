import { RUBRIC, roundScore } from "@/components/Score";
import type { Article } from "@/lib/articles";
import { cn } from "@/lib/utils";

/** En nivå av AI-relevans i en lista, t.ex. alla med 5. */
export type Tier = { score: number; items: Article[] };

/** Delar en lista (sorterad på AI-relevans, högst först) i nivåer. */
export function groupByScore(items: Article[]): Tier[] {
  const tiers: Tier[] = [];
  for (const a of items) {
    const score = roundScore(a.relevance_score);
    const last = tiers[tiers.length - 1];
    if (last && last.score === score) last.items.push(a);
    else tiers.push({ score, items: [a] });
  }
  return tiers;
}

/**
 * Rubrik för en nivå: "AI-relevans 5 · Praxisförändrande …" och antalet.
 * Skalans text står här en gång i stället för på varje artikel.
 */
export function TierHeading({
  tier,
  as: Tag = "h3",
  className,
}: {
  tier: Tier;
  as?: "h3" | "div";
  className?: string;
}) {
  const rubric = RUBRIC.find((r) => r.score === tier.score)?.text;
  return (
    <Tag className={cn("text-meta text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">AI-relevans {tier.score}</span>
      {rubric && <> · {rubric}</>}
      <span className="whitespace-nowrap">
        {" "}
        · {tier.items.length} {tier.items.length === 1 ? "artikel" : "artiklar"}
      </span>
    </Tag>
  );
}

/** Ruta med listrader, en band-rubrik per nivå. Samma utseende som i listvyn. */
export const TIER_BAND_CLASS = "border-t border-border bg-muted px-3 py-2 first:border-t-0 sm:px-4";
