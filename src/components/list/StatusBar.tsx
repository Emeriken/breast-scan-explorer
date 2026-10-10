import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, isoDay } from "@/lib/articles";
import { cn } from "@/lib/utils";

/** Hur gammal datan får vara innan vi varnar. Pipelinen körs varje måndag. */
const STALE_AFTER_DAYS = 8;

/**
 * Datans ålder och rytm, knappen Uppdatera med besked om vad som hände, och
 * ett filter för den senaste veckovisa uppdateringen.
 */
export function StatusBar({
  articleCount,
  journalCount,
  updated,
  latestBatch,
  latestCount,
  latestTopCount,
  nyaActive,
  onToggleNya,
  onRefresh,
  isFetching,
}: {
  articleCount: number;
  journalCount?: number;
  updated?: string;
  latestBatch: string | null;
  latestCount: number;
  latestTopCount: number;
  nyaActive: boolean;
  onToggleNya: () => void;
  /** Hämtar om datan och svarar med antalet nya artiklar */
  onRefresh: () => Promise<{ added: number } | { error: true }>;
  isFetching: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const updatedDate = updated ? new Date(updated) : null;
  const valid = updatedDate && !isNaN(updatedDate.getTime());
  const updatedDay = valid ? isoDay(updatedDate) : latestBatch;
  const ageDays = valid ? Math.floor((Date.now() - updatedDate.getTime()) / 86_400_000) : null;
  const stale = ageDays !== null && ageDays > STALE_AFTER_DAYS;

  const refresh = async () => {
    setMessage(null);
    const res = await onRefresh();
    const text =
      "error" in res
        ? "Kunde inte hämta ny data. Försök igen om en stund."
        : res.added > 0
          ? `${res.added} ${res.added === 1 ? "ny artikel" : "nya artiklar"}`
          : "Inga nya artiklar";
    setMessage(text);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 6000);
  };

  return (
    <div className="pt-4 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-meta text-muted-foreground">
          <span className={updatedDay ? "hidden sm:inline" : undefined}>
            {articleCount} artiklar
            {journalCount ? ` från ${journalCount} tidskrifter` : ""}
            {updatedDay && <span aria-hidden> · </span>}
          </span>
          {updatedDay && <>Uppdateras varje måndag, senast {formatDay(updatedDay)}</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {latestCount > 0 && (
            <button
              type="button"
              aria-pressed={nyaActive}
              onClick={onToggleNya}
              title={
                latestTopCount > 0
                  ? `${latestTopCount} av dem har AI-relevans 4–5`
                  : "Visa bara artiklar från den senaste uppdateringen"
              }
              className={cn(
                "hit-area inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                nyaActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {latestCount} nya i senaste uppdateringen
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isFetching}
            aria-label="Uppdatera"
            title="Hämta senaste datan"
            className="hit-area"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">{isFetching ? "Hämtar…" : "Uppdatera"}</span>
          </Button>
          <span aria-live="polite" className="text-meta font-medium text-foreground">
            {message}
          </span>
        </div>
      </div>

      {stale && updatedDay && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Ingen ny data sedan {formatDay(updatedDay)} ({ageDays} dagar). Bevakningen körs varje
            måndag, så en körning kan ha misslyckats. Artiklar efter det datumet saknas i listan.
          </p>
        </div>
      )}
    </div>
  );
}
