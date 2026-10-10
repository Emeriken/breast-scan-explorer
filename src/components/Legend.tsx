import { Check, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RubricList, ScoreBadge } from "@/components/Score";
import { cn } from "@/lib/utils";

function Row({ sample, children }: { sample: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 py-2">
      <div className="flex flex-wrap gap-1 pt-0.5">{sample}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

const tag = "rounded-sm border px-1.5 text-xs font-semibold uppercase leading-5 tracking-wider";

/** Förklaring av allt som syns på ett kort. Fungerar med mus, tangentbord och pekskärm. */
export function Legend({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hit-area inline-flex items-center gap-1 rounded-md text-xs font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline",
            className,
          )}
        >
          <HelpCircle aria-hidden className="h-3.5 w-3.5" />
          Så läser du kortet
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[min(80vh,var(--radix-popover-content-available-height))] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-4"
      >
        <p className="text-sm font-semibold">Så läser du kortet</p>
        <div className="mt-1 divide-y">
          <Row sample={<ScoreBadge score={4} />}>
            <p>
              Claude poängsätter varje artikel utifrån tidskrift, titel, MeSH-termer och abstract:
            </p>
            <RubricList className="mt-1.5 text-muted-foreground" />
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-border px-1 font-mono text-xs font-semibold uppercase leading-4 tracking-wider text-muted-foreground">
                AI
              </span>
            }
          >
            Texten intill är skriven av Claude utifrån PubMed-posten. Inte kliniskt beslutsstöd;
            kontrollera mot originalartikeln.
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-border/60 px-1.5 font-mono text-xs leading-5 text-muted-foreground">
                L3
              </span>
            }
          >
            Tidskriftens nivå i Karolinska Institutets tidskriftslista (KI-JL). L3 är högst; listan
            bevakar tidskrifter på L1 till L3.
          </Row>
          <Row
            sample={
              <span className="rounded-sm bg-foreground px-1.5 text-xs font-semibold uppercase leading-5 tracking-wider text-background">
                Ny
              </span>
            }
          >
            Kom med den senaste veckovisa uppdateringen.
          </Row>
          <Row
            sample={
              <>
                <span
                  className={cn(tag, "border-destructive/40 bg-destructive/10 text-destructive")}
                >
                  Indragen
                </span>
                <span className={cn(tag, "border-border bg-muted text-muted-foreground")}>
                  Rättelse
                </span>
              </>
            }
          >
            Indragen, förbehåll (expression of concern), rättelse och kommentar är tolkat utifrån
            titeln. Indragen kan också komma från PubMeds publikationstyp. Sådana poster räknas inte
            som kandidater till Månadens artikel.
          </Row>
          <Row
            sample={
              <span className="inline-flex items-center gap-0.5 rounded-sm border border-border/80 px-1 font-mono text-xs font-semibold leading-4 tracking-wider text-foreground/80">
                <Check aria-hidden className="h-3 w-3" />
                FDA
              </span>
            }
          >
            Substansen är godkänd av FDA eller centralt i EU (EMA), hämtat utan AI. Tryck på namnet
            för detaljer. Gäller substansen, inte nödvändigtvis studiens indikation.
          </Row>
          <Row
            sample={
              <span className="rounded-sm border border-amber-200/60 bg-amber-50 px-1.5 text-xs font-medium uppercase leading-5 tracking-wider text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
                Före tryck
              </span>
            }
          >
            Publiceringsdatumet ligger i framtiden; artikeln finns redan online.
          </Row>
          <Row
            sample={
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 text-xs font-semibold leading-5 text-primary">
                MeSH
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
