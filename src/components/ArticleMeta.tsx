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
          className="inline-flex h-5 items-center rounded-sm border border-border px-1.5 text-xs font-semibold leading-4 text-muted-foreground"
          title="Publiceringsdatumet ligger i framtiden. Artikeln finns sannolikt redan online (ahead of print)."
        >
          Före tryck
        </span>
      )}
    </span>
  );
}

/**
 * Kategorin som text. Ingen färgkod: kategorin står alltid utskriven, och sex
 * färger går inte att skilja säkert åt vid färgblindhet.
 */
export function CategoryTag({ category }: { category: string }) {
  return <span className="text-meta font-medium text-ink-2">{category}</span>;
}
