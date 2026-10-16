import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dataAge, formatDay } from "@/lib/articles";
import { cn } from "@/lib/utils";

/** Hur gammal datan får vara innan vi varnar. Pipelinen körs varje måndag. */
const STALE_AFTER_DAYS = 8;

/**
 * Datans ålder och rytm, knappen Uppdatera med besked om vad som hände, och
 * ett filter för den senaste veckovisa uppdateringen. På mobil visas bara
 * varningen om gammal data: filtret ligger i filterarket och Uppdatera bredvid
 * antalet träffar.
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
  refreshMessage,
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
  onRefresh: () => void;
  /** Beskedet efter Uppdatera, t.ex. "2 nya artiklar" */
  refreshMessage: string | null;
  isFetching: boolean;
}) {
  const { day: updatedDay, ageDays } = dataAge(updated, latestBatch);
  const stale = ageDays !== null && ageDays > STALE_AFTER_DAYS;

  return (
    <div className="sm:pt-6">
      <div className="hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:flex">
        <p className="text-meta text-muted-foreground">
          {articleCount} artiklar
          {journalCount ? ` från ${journalCount} tidskrifter` : ""}
          {updatedDay && (
            <>
              <span aria-hidden> · </span>
              Uppdateras varje måndag, senast {formatDay(updatedDay)}
            </>
          )}
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
                "hit-area inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                nyaActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-card text-foreground hover:bg-muted",
              )}
            >
              {latestCount} nya i senaste uppdateringen
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            title="Hämta senaste datan"
            className="hit-area"
          >
            <RefreshCw aria-hidden className={cn("h-4 w-4", isFetching && "animate-spin")} />
            {isFetching ? "Hämtar…" : "Uppdatera"}
          </Button>
          <span aria-live="polite" className="text-meta font-medium text-foreground">
            {refreshMessage}
          </span>
        </div>
      </div>

      {stale && updatedDay && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn"
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
