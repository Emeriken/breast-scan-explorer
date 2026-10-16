import { cn } from "@/lib/utils";
import { AI_NOTE } from "@/components/Labels";
import type { DeepAnalysis as DeepAnalysisData } from "@/lib/articles";

type Fields = NonNullable<DeepAnalysisData>;

/**
 * Fälten i djupanalysen, i visningsordning. Ändra här för att ändra överallt.
 *
 * "Jämfört med standard" (vs_standard) och "Tillämpbarhet" (applicability)
 * visas inte: de är AI:ns egna kliniska tolkningar och inte en sammanfattning
 * av vad artikeln rapporterar. Fälten finns kvar i datat och i MCP-verktygen.
 */
const FIELDS: [keyof Fields, string][] = [
  ["central_finding", "Centralt fynd"],
  ["limitation", "Begränsning"],
];

export function hasDeepAnalysis(da: DeepAnalysisData | undefined): da is Fields {
  return !!da && FIELDS.some(([k]) => !!da[k]);
}

/**
 * Djupanalysen som en grå panel med fälten bredvid varandra när det får
 * plats. Står alltid i AI-delen (under den streckade linjen) och avslutas med
 * AI-förklaringen. Används på alla sidor.
 */
export function DeepAnalysisList({
  da,
  id,
  className,
}: {
  da: Fields;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex flex-col gap-3 rounded-md bg-muted px-4 py-3.5", className)}>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(17.5rem,100%),1fr))] gap-x-7 gap-y-3">
        {FIELDS.map(([k, label]) =>
          da[k] ? (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 text-sm leading-[22px] text-ink-2">{da[k]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="text-xs leading-[18px] text-muted-foreground">
        {AI_NOTE} Kontrollera mot originalartikeln.
      </p>
    </div>
  );
}
