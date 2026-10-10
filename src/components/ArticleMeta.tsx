import { categoryColor } from "@/lib/categories";
import { formatPubDate, parsePubDate } from "@/lib/journals";

/** Publiceringsdatum med PubMeds precision, och "Före tryck" för framtida datum. */
export function PubDateDisplay({ pubDate }: { pubDate?: string }) {
  if (!pubDate) return null;
  const ms = parsePubDate(pubDate);
  const isFuture = ms > Date.now() + 30 * 24 * 60 * 60 * 1000;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatPubDate(pubDate)}</span>
      {isFuture && (
        <span
          className="rounded-sm border border-amber-200/60 bg-amber-50 px-1.5 text-xs font-medium uppercase leading-5 tracking-wider text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
          title="Publiceringsdatumet ligger i framtiden. Artikeln finns sannolikt redan online (ahead of print)."
        >
          Före tryck
        </span>
      )}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const c = categoryColor(category);
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-medium text-muted-foreground">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: c.solid }}
      />
      {category}
    </span>
  );
}
