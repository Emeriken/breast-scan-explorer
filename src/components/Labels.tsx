import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { noticeFor, type NoticeKind } from "@/lib/notices";

/** Förklaring som visas vid all AI-genererad text. */
export const AI_NOTE = "AI-genererad av Claude utifrån PubMed-posten. Inte kliniskt beslutsstöd.";

const AI_TAG_CLASS =
  "inline-flex items-center rounded-sm border border-border px-1 align-middle font-mono text-xs font-semibold uppercase leading-4 tracking-wider text-muted-foreground";

/**
 * Etikett som markerar att intilliggande text eller bedömning är AI-genererad.
 * Går att trycka på (även på mobil) för att se vad det betyder. `static`
 * används där förklaringen redan står bredvid.
 */
export function AiTag({ className, static: isStatic }: { className?: string; static?: boolean }) {
  if (isStatic) {
    return (
      <span title={AI_NOTE} className={cn(AI_TAG_CLASS, className)}>
        <span aria-hidden>AI</span>
        <span className="sr-only">AI-genererat:</span>
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="AI-genererat. Visa förklaring"
          className={cn(
            AI_TAG_CLASS,
            "hit-area cursor-pointer transition-colors hover:border-foreground/40 hover:text-foreground",
            className,
          )}
        >
          AI
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={16}
        className="w-64 p-3 text-xs leading-relaxed"
      >
        <p className="font-semibold">AI-genererat</p>
        <p className="mt-1 text-muted-foreground">{AI_NOTE} Kontrollera mot originalartikeln.</p>
      </PopoverContent>
    </Popover>
  );
}

const NOTICE_TONE: Record<NoticeKind, string> = {
  retraction: "border-destructive/40 bg-destructive/10 text-destructive",
  concern:
    "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200",
  correction: "border-border bg-muted text-muted-foreground",
  comment: "border-border bg-muted text-muted-foreground",
};

/**
 * Märkning för rättelser, indragningar, förbehåll och kommentarer. Bygger på
 * titeln, utom indragna artiklar som PubMed själv har märkt. Förklaringen
 * finns i "Så läser du kortet".
 */
export function NoticeBadge({
  title,
  publicationTypes,
}: {
  title: string;
  publicationTypes?: unknown;
}) {
  const n = noticeFor(title, publicationTypes);
  if (!n) return null;
  const why = n.fromPubMed
    ? "Artikeln har dragits tillbaka enligt PubMed (Retracted Publication)."
    : "Tolkat utifrån titeln. Publikationstypen står i PubMed.";
  return (
    <span
      title={why}
      className={cn(
        "rounded-sm border px-1.5 text-xs font-semibold uppercase leading-5 tracking-wider",
        NOTICE_TONE[n.kind],
      )}
    >
      {n.label}
      <span className="sr-only"> ({why})</span>
    </span>
  );
}

/** "Ny": artikeln kom med den senaste veckovisa uppdateringen. */
export function NewBadge() {
  return (
    <span
      title="Kom med den senaste veckovisa uppdateringen"
      className="rounded-sm bg-foreground px-1.5 text-xs font-semibold uppercase leading-5 tracking-wider text-background"
    >
      Ny
    </span>
  );
}
