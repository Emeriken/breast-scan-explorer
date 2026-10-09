import { cn } from "@/lib/utils";
import { noticeType, type NoticeKind } from "@/lib/notices";

/** Förklaring som visas vid all AI-genererad text. */
export const AI_NOTE =
  "AI-genererad av Claude utifrån PubMed-posten. Inte kliniskt beslutsstöd.";

/** Liten etikett som markerar att intilliggande text eller bedömning är AI-genererad. */
export function AiTag({ className }: { className?: string }) {
  return (
    <span
      title={AI_NOTE}
      className={cn(
        "inline-flex items-center rounded-sm border border-border px-1 align-middle font-mono text-[11px] font-semibold uppercase leading-4 tracking-wider text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>AI</span>
      <span className="sr-only">AI-genererat:</span>
    </span>
  );
}

const NOTICE_TONE: Record<NoticeKind, string> = {
  retraction: "border-destructive/40 bg-destructive/10 text-destructive",
  concern:
    "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  correction: "border-border bg-muted text-muted-foreground",
  comment: "border-border bg-muted text-muted-foreground",
};

/** Märkning för rättelser, indragningar, förbehåll och kommentarer. Bygger på titeln. */
export function NoticeBadge({ title }: { title: string }) {
  const n = noticeType(title);
  if (!n) return null;
  return (
    <span
      title="Tolkat utifrån titeln. Publikationstypen står i PubMed."
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        NOTICE_TONE[n.kind],
      )}
    >
      {n.label}
    </span>
  );
}
