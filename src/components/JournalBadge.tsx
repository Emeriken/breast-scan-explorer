import { journalLevel } from "@/lib/journals";

export function JournalBadge({ journal }: { journal: string }) {
  const lvl = journalLevel(journal);
  if (lvl === null) return null;
  return (
    <span
      title={`KI-JL nivå ${lvl}`}
      className="ml-1 inline-flex items-center rounded border border-muted-foreground/30 px-1 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      L{lvl}
    </span>
  );
}
