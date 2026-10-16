import { journalLevel } from "@/lib/journals";

/** Tidskriftens nivå i KI:s tidskriftslista (KI-JL). Förklaras i "Så läser du kortet". */
export function JournalBadge({ journal }: { journal: string }) {
  const lvl = journalLevel(journal);
  if (lvl === null) return null;
  return (
    <span
      title={`KI-JL nivå ${lvl} (Karolinska Institutets tidskriftslista, L3 högst)`}
      className="ml-1.5 inline-flex h-[18px] items-center rounded-sm border border-border px-1 align-[1px] font-mono text-xs font-semibold leading-4 text-muted-foreground"
    >
      <span aria-hidden>L{lvl}</span>
      <span className="sr-only">KI-JL nivå {lvl}</span>
    </span>
  );
}
