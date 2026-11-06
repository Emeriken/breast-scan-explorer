import {
  createFileRoute,
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Presentation,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AiSections, ArticleHeading, ArticleLinks } from "@/components/ArticleParts";
import { ErrorState } from "@/components/ErrorState";
import { JcPowerPoint } from "@/components/JcPowerPoint";
import { DisclaimerFooter } from "@/components/Footer";
import { ArticleRows } from "@/components/list/ArticleRow";
import { TIER_BAND_CLASS, TierHeading, groupByScore } from "@/components/list/TierHeading";
import { RegulatorySection, hasIndications } from "@/components/RegulatoryBadges";
import { Segmented } from "@/components/Segmented";
import { articlesQueryOptions, PRODUCT_NAME, type Article } from "@/lib/articles";
import { pmidFromUrl, parsePubDateToMonth } from "@/lib/journals";
import { noticeFor } from "@/lib/notices";
import { cn } from "@/lib/utils";

/** Rättelser, indragningar och kommentarer är inte presentationskandidater. */
const isCandidateMaterial = (a: Article) => noticeFor(a.title, a.publication_types) === null;

const pmidOf = (a: Article) => a.pmid ?? pmidFromUrl(a.url);

type TreatmentKey = "cytotoxisk" | "endokrin" | "stralbehandling";

const TREATMENTS: { key: TreatmentKey; label: string; short: string; match: RegExp }[] = [
  {
    key: "cytotoxisk",
    label: "Cytotoxisk behandling",
    short: "Cytotoxisk",
    match: /(cytotox|kemo|chemo)/i,
  },
  {
    key: "endokrin",
    label: "Endokrin behandling",
    short: "Endokrin",
    match: /(endokrin|endocrine|hormon)/i,
  },
  {
    key: "stralbehandling",
    label: "Strålbehandling",
    short: "Strålbehandling",
    match: /(str[åa]l|radiation|radioth|radiot)/i,
  },
];

const MONTHS_SV = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
];

const searchSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  treatment: z.enum(["cytotoxisk", "endokrin", "stralbehandling"]).optional(),
  /** PMID för artikeln som förbereds (äldre länkar har PubMed-adressen) */
  prepare: z.union([z.number().int().positive(), z.string()]).optional(),
});

type MonthSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/manadens-artikel")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: `Journal club · ${PRODUCT_NAME}` },
      {
        name: "description",
        content:
          "Välj kandidatartiklar för månadens journal club-presentation och förbered checklistan.",
      },
    ],
  }),
  component: ManadensArtikel,
});

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Månad som ett heltal (år * 12 + månadsindex), lätt att jämföra och sortera. */
const monthKey = (y: number, m: number) => y * 12 + (m - 1);
const fromMonthKey = (k: number) => ({ year: Math.floor(k / 12), month: (k % 12) + 1 });

type MonthCounts = { top: number; three: number };

/** Antal kandidater som listan visar: AI-relevans 4–5, annars 3. */
const candidateCount = (c: MonthCounts | undefined) => (!c ? 0 : c.top > 0 ? c.top : c.three);

function CandidatesInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hit-area inline-flex items-center gap-1.5 text-meta font-medium text-ink-2 underline-offset-2 hover:text-foreground hover:underline"
        >
          <Info aria-hidden className="h-3.5 w-3.5" />
          Så väljs kandidaterna
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-80 p-3 text-xs leading-relaxed"
      >
        <p>
          Kandidaterna är artiklar inom behandlingsområdet med AI-relevans 4–5. Finns inga sådana
          visas artiklar med AI-relevans 3.
        </p>
        <p className="mt-2">
          Artiklarna grupperas efter publiceringsmånad i PubMed. Artiklar med publiceringsdatum i
          framtiden (före tryck) räknas till månaden då de lades till. Rättelser, indragningar och
          kommentarer räknas inte som kandidater.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function MonthStepper({
  year,
  month,
  counts,
  firstKey,
  lastKey,
  onChange,
  disabled = false,
}: {
  year: number;
  month: number;
  counts: Map<number, MonthCounts>;
  firstKey: number | null;
  lastKey: number | null;
  onChange: (year: number, month: number) => void;
  /** Medan datat laddas: månaden är bara en gissning */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevDisabled = firstKey !== null && monthKey(prev.year, prev.month) < firstKey;
  const nextDisabled = lastKey !== null && monthKey(next.year, next.month) > lastKey;
  const current = monthKey(year, month);

  // Alla månader i datat, nyast först, grupperade per år
  const keys: number[] = [];
  if (firstKey !== null && lastKey !== null) {
    for (let k = Math.max(lastKey, current); k >= Math.min(firstKey, current); k--) keys.push(k);
  } else {
    keys.push(current);
  }
  const years = Array.from(new Set(keys.map((k) => fromMonthKey(k).year)));

  return (
    <div className="flex w-full items-center gap-1.5 sm:w-auto">
      <Button
        variant="outline"
        size="icon"
        className="hit-area shrink-0"
        disabled={disabled || prevDisabled}
        aria-label={`Föregående månad: ${MONTHS_SV[prev.month - 1]} ${prev.year}`}
        onClick={() => onChange(prev.year, prev.month)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            className="h-9 min-w-0 flex-1 justify-between gap-2 px-3 text-meta font-normal sm:flex-none"
            aria-label={`Publiceringsmånad: ${MONTHS_SV[month - 1]} ${year}. Välj månad`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Publicerad:</span>
              <span className="truncate font-semibold">
                {MONTHS_SV[month - 1]} {year}
              </span>
            </span>
            <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          collisionPadding={16}
          className="max-h-[min(22rem,var(--radix-popover-content-available-height))] w-64 overflow-y-auto p-1"
        >
          {years.map((y) => (
            <div key={y}>
              <p className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{y}</p>
              {keys
                .filter((k) => fromMonthKey(k).year === y)
                .map((k) => {
                  const m = fromMonthKey(k);
                  const c = candidateCount(counts.get(k));
                  const isCurrent = k === current;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={() => {
                        onChange(m.year, m.month);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                        isCurrent && "bg-muted font-semibold",
                        c === 0 && "text-muted-foreground",
                      )}
                    >
                      <span>{MONTHS_SV[m.month - 1]}</span>
                      <span className="text-xs tabular-nums">
                        {c > 0 ? `${c} ${c === 1 ? "kandidat" : "kandidater"}` : "inga kandidater"}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        className="hit-area shrink-0"
        disabled={disabled || nextDisabled}
        aria-label={`Nästa månad: ${MONTHS_SV[next.month - 1]} ${next.year}`}
        onClick={() => onChange(next.year, next.month)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ManadensArtikel() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);

  const articles = useMemo(() => data?.articles ?? [], [data]);

  // Publiceringsmånader i datat, och antal kandidater per behandlingsområde och månad
  const monthStats = useMemo(() => {
    const all = new Set<number>();
    const byTreatment: Record<TreatmentKey, Map<number, MonthCounts>> = {
      cytotoxisk: new Map(),
      endokrin: new Map(),
      stralbehandling: new Map(),
    };
    for (const a of articles) {
      const p = parsePubDateToMonth(a.pub_date, a.scored_at);
      if (!p) continue;
      const k = monthKey(p.y, p.m);
      all.add(k);
      const score = Math.round(a.relevance_score);
      if (score < 3 || !isCandidateMaterial(a)) continue;
      for (const t of TREATMENTS) {
        if (!t.match.test(a.category || "")) continue;
        const c = byTreatment[t.key].get(k) ?? { top: 0, three: 0 };
        if (score >= 4) c.top += 1;
        else c.three += 1;
        byTreatment[t.key].set(k, c);
      }
    }
    const sorted = Array.from(all).sort((x, y) => x - y);
    return {
      first: sorted.length ? sorted[0] : null,
      last: sorted.length ? sorted[sorted.length - 1] : null,
      byTreatment,
    };
  }, [articles]);

  const now = new Date();
  const treatment = (search.treatment ?? "cytotoxisk") as TreatmentKey;

  // Utan vald månad: öppna på senaste månaden som har kandidater i det valda området
  const latestCandidateKey = useMemo(() => {
    let best: number | null = null;
    for (const [k, c] of monthStats.byTreatment[treatment]) {
      if (candidateCount(c) > 0 && (best === null || k > best)) best = k;
    }
    return best;
  }, [monthStats, treatment]);
  const defaultKey =
    latestCandidateKey ?? monthStats.last ?? monthKey(now.getFullYear(), now.getMonth() + 1);
  const defaultMonth = fromMonthKey(defaultKey);

  const month = search.month ?? defaultMonth.month;
  const year = search.year ?? defaultMonth.year;

  /** Byte av månad eller område ersätter historikposten; att öppna förberedelsen lägger till en. */
  const setSearch = (next: Partial<MonthSearch>, opts: { push?: boolean } = {}) =>
    navigate({
      search: (prev: MonthSearch) => ({ ...prev, ...next }),
      replace: !opts.push,
    });
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const treatmentDef = TREATMENTS.find((t) => t.key === treatment)!;

  const monthCandidates = useMemo(() => {
    return articles.filter((a) => {
      if (!isCandidateMaterial(a)) return false;
      const p = parsePubDateToMonth(a.pub_date, a.scored_at);
      if (!p) return false;
      if (p.y !== year || p.m !== month) return false;
      return treatmentDef.match.test(a.category || "");
    });
  }, [articles, year, month, treatmentDef]);

  // AI-relevans 4–5 från andra behandlingsområden samma månad
  const otherTopArticles = useMemo(() => {
    return articles
      .filter((a) => {
        if (!isCandidateMaterial(a)) return false;
        const p = parsePubDateToMonth(a.pub_date, a.scored_at);
        if (!p) return false;
        if (p.y !== year || p.m !== month) return false;
        if (treatmentDef.match.test(a.category || "")) return false;
        return Math.round(a.relevance_score) >= 4;
      })
      .sort(sortByScoreThenDate);
  }, [articles, year, month, treatmentDef]);

  const top = monthCandidates
    .filter((a) => Math.round(a.relevance_score) >= 4)
    .sort(sortByScoreThenDate);
  const fallback = monthCandidates
    .filter((a) => Math.round(a.relevance_score) === 3)
    .sort(sortByScoreThenDate);

  const useFallback = top.length === 0 && fallback.length > 0;
  const list = top.length > 0 ? top : fallback;

  const prepareParam = search.prepare === undefined ? "" : String(search.prepare);
  const prepareArticle = useMemo(() => {
    if (!prepareParam) return null;
    const byPmid = /^\d+$/.test(prepareParam);
    return (
      articles.find((a) => (byPmid ? pmidOf(a) === prepareParam : a.url === prepareParam)) ?? null
    );
  }, [prepareParam, articles]);

  if (prepareArticle) {
    return (
      <PrepareView
        article={prepareArticle}
        area={treatmentDef.label}
        onBack={() => (canGoBack ? router.history.back() : setSearch({ prepare: undefined }))}
      />
    );
  }

  // En länk till förberedelsen medan datat laddas: visa förberedelsens form, inte listan
  if (prepareParam && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main id="content" className="mx-auto max-w-5xl px-4 py-6 sm:py-8" aria-busy="true">
          <p className="sr-only" role="status">
            Laddar artikeln
          </p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="h-96 animate-pulse rounded-md border bg-card" />
            <div className="h-72 animate-pulse rounded-md border bg-card" />
          </div>
        </main>
      </div>
    );
  }

  const prepareNotFound = Boolean(prepareParam) && !isLoading && !error;

  const latestCandidate = latestCandidateKey !== null ? fromMonthKey(latestCandidateKey) : null;
  const showJumpToLatest =
    latestCandidate !== null && (latestCandidate.year !== year || latestCandidate.month !== month);

  // Få kandidater den här månaden? Peka på närmaste tidigare månad med fler.
  const counts = monthStats.byTreatment[treatment];
  const shownCount = candidateCount(counts.get(monthKey(year, month)));
  let richer: { year: number; month: number; count: number } | null = null;
  if (shownCount > 0 && shownCount < 3) {
    for (let k = monthKey(year, month) - 1; k >= (monthStats.first ?? Infinity); k--) {
      const c = candidateCount(counts.get(k));
      if (c >= 3) {
        richer = { ...fromMonthKey(k), count: c };
        break;
      }
    }
  }

  const prepare = (a: Article) => {
    const pmid = pmidOf(a);
    setSearch({ prepare: pmid ? Number(pmid) : a.url }, { push: true });
  };

  const monthLabel = `${MONTHS_SV[month - 1].toLowerCase()} ${year}`;
  const prepareButton = (a: Article) => (
    <Button variant="outline" size="sm" onClick={() => prepare(a)}>
      <Presentation aria-hidden className="h-4 w-4" />
      Förbered presentation
    </Button>
  );
  /** Kandidater som listrader, en rubrik per AI-relevans (som i Alla artiklar). */
  const rows = (items: Article[]) => (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      {groupByScore(items).map((t) => (
        <div key={t.score}>
          <TierHeading tier={t} as="div" className={TIER_BAND_CLASS} />
          <ArticleRows items={t.items} query={null} listSearch={{}} action={prepareButton} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main id="content" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-8 outline-none">
        <div className="flex flex-col gap-1 pb-4 pt-6 sm:pt-7">
          <h1 className="text-2xl font-semibold leading-7.5 tracking-[-0.02em]">Journal club</h1>
          <p className="text-sm leading-5.5 text-pretty text-muted-foreground">
            Välj månadens artikel och förbered en presentation på 15 minuter.
          </p>
        </div>

        {prepareNotFound && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warn-line bg-warn-bg px-4 py-3 text-sm text-warn"
          >
            <p>Artikeln i länken finns inte i datat. Välj en kandidat nedan.</p>
            <Button variant="outline" size="sm" onClick={() => setSearch({ prepare: undefined })}>
              Stäng
            </Button>
          </div>
        )}

        <section
          aria-label="Välj område och månad"
          className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-y border-border py-3"
        >
          <Segmented
            inline
            label="Område"
            ariaLabel="Behandlingsområde"
            value={treatment}
            options={TREATMENTS.map((t) => ({ value: t.key, label: t.short, title: t.label }))}
            // Månaden står kvar när man byter område
            onChange={(t) => setSearch({ treatment: t, year, month })}
            className="max-w-full overflow-x-auto"
          />
          <MonthStepper
            year={year}
            month={month}
            counts={counts}
            firstKey={monthStats.first}
            lastKey={monthStats.last}
            onChange={(y, m) => setSearch({ year: y, month: m })}
            disabled={isLoading}
          />
          <div className="ml-auto">
            <CandidatesInfo />
          </div>
        </section>

        <section className="mt-6" aria-live="polite" aria-busy={isLoading}>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-md border bg-card" />
              ))}
            </div>
          )}

          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !error && list.length === 0 && (
            <div className="rounded-md border border-dashed border-input p-8 text-center sm:p-10">
              <p className="font-medium">Inga kandidater för {monthLabel}.</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                Inga artiklar inom {treatmentDef.label.toLowerCase()} med AI-relevans 3 eller högre
                har publiceringsmånad {monthLabel}.
              </p>
              {showJumpToLatest && latestCandidate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    setSearch({ year: latestCandidate.year, month: latestCandidate.month })
                  }
                >
                  Gå till senaste månaden med kandidater: {MONTHS_SV[latestCandidate.month - 1]}{" "}
                  {latestCandidate.year}
                </Button>
              )}
            </div>
          )}

          {!isLoading && !error && list.length > 0 && (
            <>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-heading font-semibold tracking-[-0.01em]">
                  Kandidater{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {treatmentDef.label}, {monthLabel}
                  </span>
                </h2>
                <p className="text-meta text-muted-foreground">
                  {list.length} {list.length === 1 ? "kandidat" : "kandidater"}
                </p>
              </div>
              {richer && (
                <p className="mb-3 text-meta text-muted-foreground">
                  Få kandidater i {monthLabel}.{" "}
                  <button
                    type="button"
                    onClick={() => setSearch({ year: richer.year, month: richer.month })}
                    className="hit-area font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                  >
                    {MONTHS_SV[richer.month - 1]} {richer.year} har {richer.count}
                  </button>
                </p>
              )}
              {useFallback && (
                <div className="mb-3 rounded-md border border-warn-line bg-warn-bg p-3 text-sm text-warn">
                  Inga artiklar med AI-relevans 4–5 den här månaden. Visar artiklar med AI-relevans
                  3 i stället.
                </div>
              )}
              {rows(list)}
            </>
          )}
        </section>

        {!isLoading && !error && otherTopArticles.length > 0 && (
          <OtherAreas count={otherTopArticles.length} monthLabel={monthLabel}>
            {rows(otherTopArticles)}
          </OtherAreas>
        )}

        {!isLoading && !error && (
          <p className="mt-10 border-t border-border pt-6 text-sm leading-5.5 text-pretty text-muted-foreground">
            En annan artikel? Öppna den under{" "}
            <Link
              to="/"
              search={{ cat: [treatmentDef.label] }}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Alla artiklar
            </Link>{" "}
            och välj <span className="font-medium text-ink-2">Förbered för journal club</span>.
          </p>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}

/** AI-relevans 4–5 från andra områden, ihopfällt: ett stöd, inte huvudvalet. */
function OtherAreas({
  count,
  monthLabel,
  children,
}: {
  count: number;
  monthLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="mt-8" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-heading font-semibold tracking-[-0.01em]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((v) => !v)}
          className="hit-area inline-flex items-center gap-2 rounded-sm text-left hover:text-foreground/80"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          AI-relevans 4–5 i andra områden
          <span className="text-sm font-normal text-muted-foreground">{count}</span>
        </button>
      </h2>
      <p className="ml-6 mt-1 text-meta text-pretty text-muted-foreground">
        Från {monthLabel}. Värda att lyfta om ditt eget område har få kandidater.
      </p>
      {open && (
        <div id={id} className="mt-3">
          {children}
        </div>
      )}
    </section>
  );
}

function sortByScoreThenDate(a: Article, b: Article) {
  if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
  return (b.scored_at ?? "").localeCompare(a.scored_at ?? "");
}

/**
 * Checklistan, i tre delar i presentationens ordning. Punkternas ordning är
 * densamma som tidigare, så sparade bockar hamnar rätt.
 */
const CHECKLIST_ITEMS = [
  "Bakgrund och kunskapslucka",
  "Forskningsfråga och studiedesign (PICO)",
  "Patientpopulation",
  "Primärt resultat (HR, KI, p-värde)",
  "Sekundära effektmått och subgrupper",
  "Biverkningsprofil",
  "Styrkor och begränsningar",
  "Klinisk implikation för SÖS-patienter",
  "En eller två diskussionsfrågor",
];

/** Vilken bild i presentationen punkten hör till, och var AI-texten kan hjälpa. */
const CHECKLIST_HINTS: { slide: string; ai?: "central_finding" | "limitation" }[] = [
  { slide: "Bild 2" },
  { slide: "Bild 2–3" },
  { slide: "Bild 3" },
  { slide: "Bild 4", ai: "central_finding" },
  { slide: "Bild 4" },
  { slide: "Bild 4" },
  { slide: "Bild 6", ai: "limitation" },
  { slide: "Bild 7" },
  { slide: "Bild 8" },
];

const AI_HINT_LABEL = {
  central_finding: "Se Centralt fynd i AI-djupanalysen",
  limitation: "Se Begränsning i AI-djupanalysen",
};

const CHECKLIST_GROUPS = [
  { title: "Studien", items: [0, 1, 2] },
  { title: "Resultat", items: [3, 4, 5] },
  { title: "Diskussion", items: [6, 7, 8] },
];

function PrepareView({
  article,
  area,
  onBack,
}: {
  article: Article;
  /** Journal clubens område, till PowerPoint-presentationen */
  area: string;
  onBack: () => void;
}) {
  const storageKey = `presentation-checklist:${article.url}`;
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const [printIndications, setPrintIndications] = useState(false);
  // Listan före "Börja om", så att det går att ångra en stund
  const [undo, setUndo] = useState<boolean[] | null>(null);
  // Spara först när den sparade listan för just den här artikeln är inläst,
  // annars skrivs den över med en tom lista innan den hunnit läsas in.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let next = CHECKLIST_ITEMS.map(() => false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === CHECKLIST_ITEMS.length) {
        next = parsed.map(Boolean);
      }
    } catch {
      // Lagring blockerad eller trasig: börja med en tom lista
    }
    setChecked(next);
    setUndo(null);
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // Lagring blockerad: listan gäller bara den här sidvisningen
    }
  }, [storageKey, checked, loadedKey]);

  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    document.title = `Förbered: ${article.title.slice(0, 50)} · ${PRODUCT_NAME}`;
  }, [article.title]);

  const toggle = (i: number) => {
    setUndo(null);
    setChecked((arr) => arr.map((v, idx) => (idx === i ? !v : v)));
  };
  const reset = () => {
    setUndo(checked);
    setChecked(CHECKLIST_ITEMS.map(() => false));
  };
  const done = checked.filter(Boolean).length;
  const allDone = done === CHECKLIST_ITEMS.length;
  const da = article.deep_analysis;

  return (
    <div className="min-h-screen bg-background">
      <main
        id="content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-6 outline-none sm:py-8 print:max-w-none print:px-0 print:py-0"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hit-area -ml-2 px-2 text-sm text-ink-2"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>
            <p className="truncate text-meta text-muted-foreground">
              Förbereder journal club · {area}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasIndications(article.regulatory) && (
              <label className="flex cursor-pointer items-center gap-2 text-meta text-muted-foreground">
                <Checkbox
                  checked={printIndications}
                  onCheckedChange={(v) => setPrintIndications(v === true)}
                />
                Ta med indikationstexter i utskriften
              </label>
            )}
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Skriv ut
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] print:block">
          <article className="flex min-w-0 flex-col rounded-md border border-border bg-card px-5 pb-7 pt-6 sm:px-7 sm:pb-8 sm:pt-7 print:rounded-none print:border-0 print:p-0">
            <ArticleHeading article={article} doiInline />
            <ArticleLinks article={article} className="mt-4.5 print:hidden" />
            <AiSections article={article} />
            <RegulatorySection
              reg={article.regulatory}
              printIndications={printIndications}
              className="mt-7 border-t border-border pt-6"
            />
          </article>

          <div className="flex flex-col gap-4 print:mt-8">
            <JcPowerPoint article={article} area={area} />

            <section className="rounded-md border border-border bg-card px-5 py-5 sm:px-6 print:rounded-none print:border-0 print:p-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-heading font-semibold tracking-[-0.01em]">
                  Checklista för 15 minuter
                </h2>
                <p className="text-meta text-muted-foreground print:hidden" aria-live="polite">
                  {undo ? (
                    <>
                      Tömd ·{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setChecked(undo);
                          setUndo(null);
                        }}
                        className="hit-area font-medium text-foreground underline underline-offset-2"
                      >
                        Ångra
                      </button>
                    </>
                  ) : allDone ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                      Alla {CHECKLIST_ITEMS.length} klara
                    </span>
                  ) : (
                    <>
                      {done} av {CHECKLIST_ITEMS.length} klara
                    </>
                  )}
                </p>
              </div>
              <div
                aria-hidden
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted print:hidden"
              >
                <div
                  className="h-full rounded-full bg-foreground transition-[width]"
                  style={{ width: `${(done / CHECKLIST_ITEMS.length) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground print:hidden">
                Bildnumren gäller PowerPoint-presentationen. Sparas i den här webbläsaren
                {done > 0 && !undo && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={reset}
                      className="hit-area font-medium text-ink-2 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Börja om
                    </button>
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {CHECKLIST_GROUPS.map((g) => (
                  <fieldset key={g.title}>
                    <legend className="text-xs font-semibold text-muted-foreground">
                      {g.title}
                    </legend>
                    <ul className="mt-0.5">
                      {g.items.map((i) => {
                        const hint = CHECKLIST_HINTS[i];
                        const aiText = hint.ai && da?.[hint.ai] ? AI_HINT_LABEL[hint.ai] : null;
                        return (
                          <li key={i} className="flex items-start gap-3">
                            <Checkbox
                              id={`chk-${i}`}
                              checked={checked[i]}
                              onCheckedChange={() => toggle(i)}
                              aria-describedby={`chk-${i}-hint`}
                              className="mt-2 print:hidden"
                            />
                            <span className="mt-1.5 hidden h-4 w-4 shrink-0 rounded-sm border border-foreground print:inline-block" />
                            <div className="flex-1 py-1">
                              <label
                                htmlFor={`chk-${i}`}
                                className={cn(
                                  "block cursor-pointer text-sm leading-5.5",
                                  checked[i] &&
                                    "text-muted-foreground line-through print:text-foreground print:no-underline",
                                )}
                              >
                                {CHECKLIST_ITEMS[i]}
                              </label>
                              <p id={`chk-${i}-hint`} className="text-xs text-muted-foreground">
                                {hint.slide}
                                {aiText && <> · {aiText}</>}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
