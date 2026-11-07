import { ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { externalLinkProps } from "@/lib/categories";
import {
  armTypeLabel,
  designLabel,
  enrollmentLabel,
  interventionName,
  isrctnIds,
  isrctnUrl,
  looksLikeTrial,
  phaseLabel,
  registryDate,
  SOURCE_TEXT,
  statusLabel,
  trialSearchTerm,
  trialSearchUrl,
  trialShortName,
  trialUrl,
  type ArticleTrials,
  type Trial,
} from "@/lib/trials";
import type { Article } from "@/lib/articles";
import { cn } from "@/lib/utils";

/**
 * Registrerade studier från ClinicalTrials.gov. Pipelinen hämtar dem utan AI
 * för artiklar som anger ett NCT-nummer (se src/lib/trials.ts). Texterna står
 * som i registret, på engelska; bara etiketterna är översatta.
 */

function Source({ trials, className }: { trials: ArticleTrials; className?: string }) {
  const checked = trials.checkedAt ? registryDate(trials.checkedAt.slice(0, 10)) : undefined;
  return (
    <p className={cn("text-xs leading-4.5 text-muted-foreground", className)}>
      Från ClinicalTrials.gov{checked ? `, hämtat ${checked}` : ""}.{" "}
      {trials.source ? `${SOURCE_TEXT[trials.source]} ` : ""}Visar hur studien är registrerad, inte
      vad artikeln rapporterar. Ingen AI.
    </p>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
      <dt className="text-xs leading-5 text-muted-foreground">{term}</dt>
      <dd className="text-sm leading-5 text-ink-2">{children}</dd>
    </div>
  );
}

/** Studiens uppgifter: design, deltagare, armar, primärt effektmått, sponsor och status. */
export function TrialDetails({ trial: t, className }: { trial: Trial; className?: string }) {
  const design = designLabel(t);
  const enrollment = enrollmentLabel(t);
  const status = statusLabel(t);
  const start = registryDate(t.start);
  const primaryEnd = registryDate(t.primary_completion);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <p className="text-sm font-semibold leading-5.5 text-foreground">
          {t.acronym && <>{t.acronym} · </>}
          <a
            href={trialUrl(t.nct)}
            {...externalLinkProps}
            className="font-mono text-meta font-semibold underline-offset-2 hover:underline"
          >
            {t.nct}
            <ExternalLink aria-hidden className="ml-1 inline h-3 w-3 align-baseline opacity-60" />
            <span className="sr-only"> (öppnas i ny flik)</span>
          </a>
        </p>
        {t.title && <p className="mt-0.5 text-meta text-pretty text-ink-2">{t.title}</p>}
      </div>
      <dl className="flex flex-col gap-1.5">
        {design && <Fact term="Design">{design}</Fact>}
        {enrollment && <Fact term="Deltagare">{enrollment}</Fact>}
        {t.arms?.length ? (
          <Fact term="Armar">
            <ul className="flex flex-col gap-1">
              {t.arms.map((arm, i) => {
                const names = (arm.interventions ?? []).map(interventionName);
                const showNames = names.length > 0 && names.join(", ") !== arm.label;
                return (
                  <li key={i}>
                    {arm.type && (
                      <span className="text-xs text-muted-foreground">
                        {armTypeLabel(arm.type)}:{" "}
                      </span>
                    )}
                    {arm.label}
                    {showNames && (
                      <span className="text-muted-foreground"> ({names.join(", ")})</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Fact>
        ) : null}
        {t.primary_outcomes?.length ? (
          <Fact term="Primärt effektmått">
            <ul className="flex flex-col gap-1">
              {t.primary_outcomes.map((o, i) => (
                <li key={i}>
                  {o.measure}
                  {o.time_frame && <span className="text-muted-foreground"> · {o.time_frame}</span>}
                </li>
              ))}
            </ul>
          </Fact>
        ) : null}
        {t.sponsor && <Fact term="Sponsor">{t.sponsor}</Fact>}
        {(status || start || primaryEnd) && (
          <Fact term="Status">
            {[status, start && `start ${start}`, primaryEnd && `primärt slutdatum ${primaryEnd}`]
              .filter(Boolean)
              .join(" · ")}
          </Fact>
        )}
        <Fact term="Resultat i registret">{t.has_results ? "Ja" : "Nej"}</Fact>
      </dl>
    </div>
  );
}

/** Kort text på chippet: "TROPiCS-02 · Fas 3" */
function chipText(t: Trial) {
  const phase = t.study_type === "OBSERVATIONAL" ? "Observationsstudie" : phaseLabel(t.phases);
  return phase ? `${trialShortName(t)} · ${phase}` : trialShortName(t);
}

const CHIP_CLASS =
  "hit-area inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs transition-colors hover:border-input hover:bg-muted sm:min-h-7";
const TAG_CLASS =
  "rounded-sm border border-border px-1 font-mono text-[0.6875rem] font-semibold leading-4 tracking-wider text-muted-foreground";

/** Länk till en studie i det brittiska registret ISRCTN (inga uppgifter hämtas). */
function IsrctnChip({ id }: { id: string }) {
  return (
    <a
      href={isrctnUrl(id)}
      {...externalLinkProps}
      aria-label={`Registrerad studie ${id} i ISRCTN-registret (öppnas i ny flik)`}
      className={CHIP_CLASS}
    >
      <span className={TAG_CLASS}>ISRCTN</span>
      <span className="font-medium text-foreground">{id.replace(/^ISRCTN/, "")}</span>
      <ExternalLink aria-hidden className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}

/**
 * Ett chip per studie. Klick öppnar studiens uppgifter i en ruta, med länk
 * till registret. ISRCTN-nummer blir en direktlänk till det registret.
 */
export function TrialChips({
  trials,
  isrctn,
  className,
  label = true,
}: {
  trials?: ArticleTrials;
  /** ISRCTN-nummer från datafilen */
  isrctn?: unknown;
  className?: string;
  /** Visa "Studie:" före chippen */
  label?: boolean;
}) {
  const studies = trials?.studies ?? [];
  const uk = isrctnIds(isrctn);
  if (!studies.length && !uk.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {label && (
        <span className="text-xs text-muted-foreground">
          {studies.length + uk.length === 1 ? "Studie:" : "Studier:"}
        </span>
      )}
      {uk.map((id) => (
        <IsrctnChip key={id} id={id} />
      ))}
      {trials &&
        studies.map((t) => (
          <Popover key={t.nct}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Registrerad studie ${t.nct}${t.acronym ? `, ${t.acronym}` : ""}: visa uppgifter från ClinicalTrials.gov`}
                className={CHIP_CLASS}
              >
                <span className={TAG_CLASS}>CT.gov</span>
                <span className="font-medium text-foreground">{chipText(t)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={16}
              className="max-h-[min(70vh,var(--radix-popover-content-available-height))] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto p-4"
            >
              <TrialDetails trial={t} />
              <Source trials={trials} className="mt-4 border-t pt-3" />
            </PopoverContent>
          </Popover>
        ))}
    </div>
  );
}

const SECTION_HEADING =
  "text-xs font-semibold uppercase leading-4 tracking-[0.05em] text-muted-foreground";

/**
 * Hela uppgifterna som ett avsnitt, för artikelsidan och journal club. En
 * artikel om en studie som saknar studienummer i alla källor får i stället en
 * rad om det och en sökning i ClinicalTrials.gov.
 */
export function TrialSection({
  article,
  id,
  className,
}: {
  article: Pick<Article, "title" | "publication_types" | "regulatory" | "trials" | "isrctn_ids">;
  id?: string;
  className?: string;
}) {
  const trials = article.trials;
  const uk = isrctnIds(article.isrctn_ids);
  if (!trials?.studies.length) {
    if (uk.length) {
      return (
        <section id={id} className={cn("scroll-mt-4", className)}>
          <h2 className={SECTION_HEADING}>Registrerad studie</h2>
          <TrialChips isrctn={uk} label={false} className="mt-3" />
          <p className="mt-2 text-xs leading-4.5 text-muted-foreground">
            Numret står i PubMed-posten. Studien finns i det brittiska registret ISRCTN; uppgifter
            därifrån hämtas inte.
          </p>
        </section>
      );
    }
    if (!looksLikeTrial(article)) return null;
    const term = trialSearchTerm(article);
    return (
      <section id={id} className={cn("scroll-mt-4", className)}>
        <h2 className={SECTION_HEADING}>Registrerad studie</h2>
        <p className="mt-2 text-sm leading-5.5 text-pretty text-ink-2">
          Inget studienummer hittades i PubMed-posten, hos förlaget (Crossref) eller i artikelns
          metoddel (Europe PMC). Numret står ofta i artikelns metoddel eller under abstractet.
        </p>
        {term && (
          <a
            href={trialSearchUrl(term)}
            {...externalLinkProps}
            className="hit-area mt-2 inline-flex items-center gap-1 text-meta font-medium text-foreground underline underline-offset-2"
          >
            Sök i ClinicalTrials.gov: {term}
            <ExternalLink aria-hidden className="h-3 w-3 opacity-60" />
            <span className="sr-only"> (öppnas i ny flik)</span>
          </a>
        )}
        {term && (
          <p className="mt-1 text-xs text-muted-foreground">
            Sökningen kan ge flera eller fel studier. Kontrollera mot artikeln.
          </p>
        )}
      </section>
    );
  }
  return (
    <section id={id} className={cn("scroll-mt-4", className)}>
      <h2 className={SECTION_HEADING}>
        {trials.studies.length === 1 ? "Registrerad studie" : "Registrerade studier"}
      </h2>
      {uk.length > 0 && <TrialChips isrctn={uk} label={false} className="mt-3" />}
      <div className="mt-3 flex flex-col gap-3">
        {trials.studies.map((t) => (
          <div
            key={t.nct}
            className="rounded-md border border-border p-4 break-inside-avoid sm:px-4.5"
          >
            <TrialDetails trial={t} />
          </div>
        ))}
      </div>
      <Source trials={trials} className="mt-3" />
    </section>
  );
}
