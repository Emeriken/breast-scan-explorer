import { cn } from "@/lib/utils";
import { AI_NOTE, AiTag } from "@/components/Labels";
import type { DeepAnalysis as DeepAnalysisData } from "@/components/ArticleBrowser";

type Fields = NonNullable<DeepAnalysisData>;

/** Fälten i djupanalysen, i visningsordning. Ändra här för att ändra överallt. */
const FIELDS: [keyof Fields, string][] = [
  ["central_finding", "Centralt fynd"],
  ["limitation", "Begränsning"],
  ["vs_standard", "Jämfört med standard"],
  ["applicability", "Tillämpbarhet"],
];

export function hasDeepAnalysis(da: DeepAnalysisData | undefined): da is Fields {
  return !!da && FIELDS.some(([k]) => !!da[k]);
}

/** Djupanalysen som rutnät, med tydlig AI-märkning. Används på alla sidor. */
export function DeepAnalysisList({ da, className }: { da: Fields; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed bg-background p-4 text-sm", className)}>
      <dl className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label]) =>
          da[k] ? (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1">{da[k]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <AiTag />
        {AI_NOTE} Kontrollera mot originalartikeln.
      </p>
    </div>
  );
}
