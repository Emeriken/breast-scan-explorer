import { journalLevel } from "@/lib/journals";

export function JournalBadge({ journal }: { journal: string }) {
  const lvl = journalLevel(journal);
  if (lvl === null) return null;
  return (
    <span
      title={`KI-JL nivå ${lvl}`}
      className="ml-1.5 inline-flex items-center rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wider text-muted-foreground"
    >
      L{lvl}
    </span>
  );
}
