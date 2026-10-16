import { Ban, Check, HelpCircle, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NewBadge } from "@/components/Labels";
import { RubricList, ScoreBadge } from "@/components/Score";
import { cn } from "@/lib/utils";

/** Exempel och förklaring bredvid varandra. `stack` lägger exemplet ovanför, för breda märken. */
function Row({
  sample,
  stack,
  children,
}: {
  sample: ReactNode;
  stack?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-start py-2",
        stack ? "grid-cols-1 gap-2" : "grid-cols-[6.5rem_1fr] gap-3",
      )}
    >
      <div className="flex flex-wrap gap-1 pt-0.5">{sample}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

const tag =
  "inline-flex h-[22px] items-center gap-1 rounded-sm border px-[7px] text-xs font-semibold leading-4";

/** Förklaring av allt som syns på ett kort. Fungerar med mus, tangentbord och pekskärm. */
export function Legend({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Så läser du kortet"
          className={cn(
            "hit-area inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-muted hover:text-foreground",
            "sm:h-auto sm:w-auto sm:gap-1 sm:text-xs sm:font-medium sm:underline-offset-2 sm:hover:bg-transparent sm:hover:underline",
            className,
          )}
        >
          <HelpCircle aria-hidden className="h-[18px] w-[18px] sm:h-3.5 sm:w-3.5" />
          <span className="sr-only sm:not-sr-only">Så läser du kortet</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[min(80vh,var(--radix-popover-content-available-height))] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-4"
      >
        <p className="text-sm font-semibold">Så läser du kortet</p>
        <div className="mt-1 divide-y">
          <Row stack sample={<ScoreBadge score={4} static />}>
            <p>
              Claude poängsätter varje artikel utifrån tidskrift, titel, MeSH-termer och abstract:
            </p>
            <RubricList className="mt-1.5 text-muted-foreground" />
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-input px-1 font-mono text-xs font-semibold uppercase leading-4 tracking-wider text-muted-foreground">
                AI
              </span>
            }
          >
            Texten intill är skriven av Claude utifrån PubMed-posten. Inte kliniskt beslutsstöd;
            kontrollera mot originalartikeln.
          </Row>
          <Row sample={<span className="mt-2 block w-full border-t border-dashed border-input" />}>
            Under den streckade linjen står text som Claude har skrivit: motiveringen och
            djupanalysen.
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-border px-1 font-mono text-xs font-semibold leading-4 text-muted-foreground">
                L3
              </span>
            }
          >
            Tidskriftens nivå i Karolinska Institutets tidskriftslista (KI-JL). L3 är högst; listan
            bevakar tidskrifter på L1 till L3.
          </Row>
          <Row sample={<NewBadge />}>Kom med den senaste veckovisa uppdateringen.</Row>
          <Row
            sample={
              <>
                <span className={cn(tag, "border-danger-line bg-danger-bg text-destructive")}>
                  <Ban aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                  Indragen
                </span>
                <span className={cn(tag, "border-input bg-muted text-ink-2")}>
                  <PencilLine aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                  Rättelse
                </span>
              </>
            }
          >
            Indragen, förbehåll (expression of concern), rättelse och kommentar är tolkat utifrån
            titeln. Indragen kan också komma från PubMeds publikationstyp. Sådana poster räknas inte
            som kandidater i Journal club.
          </Row>
          <Row
            sample={
              <span className="inline-flex items-center gap-0.5 rounded-sm border border-border px-1 font-mono text-xs font-semibold leading-4 tracking-wider text-ink-2">
                <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
                FDA
              </span>
            }
          >
            Substansen är godkänd av FDA eller centralt i EU (EMA), hämtat utan AI. Tryck på namnet
            för detaljer. Gäller substansen, inte nödvändigtvis studiens indikation.
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-border px-1.5 text-xs font-semibold leading-5 text-muted-foreground">
                Före tryck
              </span>
            }
          >
            Publiceringsdatumet ligger i framtiden; artikeln finns redan online.
          </Row>
          <Row
            sample={
              <span className="text-meta text-ink-2 underline decoration-input underline-offset-[3px]">
                Mastectomy
              </span>
            }
          >
            NLM:s huvudämnen för artikeln. Tryck för att visa artiklar med samma ämne. Nya artiklar
            saknar ofta MeSH-termer tills NLM har indexerat dem.
          </Row>
        </div>
      </PopoverContent>
    </Popover>
  );
}
