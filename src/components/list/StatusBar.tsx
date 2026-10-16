import { AlertTriangle } from "lucide-react";
import { dataAge, formatDay } from "@/lib/articles";
import { cn } from "@/lib/utils";

/** Hur gammal datan får vara innan vi varnar. Pipelinen körs varje måndag. */
const STALE_AFTER_DAYS = 8;

/**
 * Vad sidan är, ett filter för veckans nya artiklar och en varning om datan
 * är gammal. Filtret ligger på mobil i filterarket.
 */
export function StatusBar({
  journalCount,
  updated,
  latestBatch,
  latestCount,
  latestTopCount,
  nyaActive,
  onToggleNya,
}: {
  journalCount?: number;
  updated?: string;
  latestBatch: string | null;
  latestCount: number;
  latestTopCount: number;
  nyaActive: boolean;
  onToggleNya: () => void;
}) {
  const { day: updatedDay, ageDays } = dataAge(updated, latestBatch);
  const stale = ageDays !== null && ageDays > STALE_AFTER_DAYS;

  return (
    <div className="pt-3 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm leading-[22px] text-ink-2">
          Nya bröstcancerartiklar{journalCount ? ` från ${journalCount} tidskrifter` : ""}, med
          högst AI-bedömd relevans först. Ny lista varje måndag.
        </p>
        {latestCount > 0 && (
          <button
            type="button"
            aria-pressed={nyaActive}
            onClick={onToggleNya}
            title={
              latestTopCount > 0
                ? `${latestTopCount} av dem har AI-relevans 4–5`
                : "Visa bara artiklarna från den senaste veckans lista"
            }
            className={cn(
              "hit-area hidden h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors sm:inline-flex",
              nyaActive
                ? "border-foreground bg-foreground text-background"
                : "border-input bg-card text-foreground hover:bg-muted",
            )}
          >
            Bara veckans nya ({latestCount})
          </button>
        )}
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
