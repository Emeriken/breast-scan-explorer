import {
  createFileRoute,
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  CalendarDays,
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
import { DisclaimerFooter } from "@/components/Footer";
import { ArticleCard } from "@/components/list/ArticleCard";
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
}: {
  year: number;
  month: number;
  counts: Map<number, MonthCounts>;
  firstKey: number | null;
  lastKey: number | null;
  onChange: (year: number, month: number) => void;
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
        disabled={prevDisabled}
        aria-label={`Föregående månad: ${MONTHS_SV[prev.month - 1]} ${prev.year}`}
        onClick={() => onChange(prev.year, prev.month)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 min-w-0 flex-1 justify-between gap-2 px-3 text-[13px] font-normal sm:flex-none"
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
        disabled={nextDisabled}
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

  const prepareArticle = useMemo(() => {
    const p = search.prepare === undefined ? "" : String(search.prepare);
    if (!p) return null;
    const byPmid = /^\d+$/.test(p);
    return articles.find((a) => (byPmid ? pmidOf(a) === p : a.url === p)) ?? null;
  }, [search.prepare, articles]);

  if (prepareArticle) {
    return (
      <PrepareView
        article={prepareArticle}
        onBack={() => (canGoBack ? router.history.back() : setSearch({ prepare: undefined }))}
      />
    );
  }

  const latestCandidate = latestCandidateKey !== null ? fromMonthKey(latestCandidateKey) : null;
  const showJumpToLatest =
    latestCandidate !== null && (latestCandidate.year !== year || latestCandidate.month !== month);

  const prepare = (a: Article) => {
    const pmid = pmidOf(a);
    setSearch({ prepare: pmid ? Number(pmid) : a.url }, { push: true });
  };

  const monthLabel = `${MONTHS_SV[month - 1].toLowerCase()} ${year}`;
  const card = (a: Article) => (
    <ArticleCard
      key={a.pmid ?? a.url}
      article={a}
      query={null}
      listSearch={{}}
      meshMerge={false}
      actions={
        <Button variant="outline" onClick={() => prepare(a)}>
          <Presentation aria-hidden className="h-4 w-4" />
          Förbered presentation
        </Button>
      }
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <main id="content" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-8 outline-none">
        <div className="flex flex-col gap-1 pb-4 pt-6 sm:pt-7">
          <h1 className="text-2xl font-semibold leading-[30px] tracking-[-0.02em]">Journal club</h1>
          <p className="text-sm leading-[22px] text-muted-foreground">
            Månadens artikel: presentationskandidater för 15 minuter.
          </p>
        </div>

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
            onChange={(t) => setSearch({ treatment: t })}
            className="max-w-full overflow-x-auto"
          />
          <MonthStepper
            year={year}
            month={month}
            counts={monthStats.byTreatment[treatment]}
            firstKey={monthStats.first}
            lastKey={monthStats.last}
            onChange={(y, m) => setSearch({ year: y, month: m })}
          />
          <div className="ml-auto">
            <CandidatesInfo />
          </div>
        </section>

        <section className="mt-6" aria-live="polite">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-md border bg-card" />
              ))}
            </div>
          )}

          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !error && list.length === 0 && (
            <div className="rounded-md border border-dashed border-input p-8 text-center sm:p-10">
              <p className="font-medium">Inga kandidater för {monthLabel}.</p>
              <p className="mt-1 text-sm text-muted-foreground">
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
                <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.01em]">
                  {useFallback ? "AI-relevans 3" : "AI-relevans 4–5"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {treatmentDef.label}, {monthLabel}
                  </span>
                </h2>
                <p className="text-meta text-muted-foreground">
                  {list.length} {list.length === 1 ? "kandidat" : "kandidater"}
                </p>
              </div>
              {useFallback && (
                <div className="mb-3 rounded-md border border-warn-line bg-warn-bg p-3 text-sm text-warn">
                  Inga artiklar med AI-relevans 4–5 den här månaden. Visar artiklar med AI-relevans
                  3 i stället.
                </div>
              )}
              <div className="flex flex-col gap-3">{list.map(card)}</div>
            </>
          )}
        </section>

        {!isLoading && !error && otherTopArticles.length > 0 && (
          <section className="mt-10" aria-labelledby="andra-omraden">
            <div className="mb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id="andra-omraden"
                  className="text-[17px] font-semibold leading-6 tracking-[-0.01em]"
                >
                  AI-relevans 4–5 i andra områden
                </h2>
                <p className="text-meta text-muted-foreground">
                  {otherTopArticles.length} {otherTopArticles.length === 1 ? "artikel" : "artiklar"}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Från {monthLabel}. Värdefulla att lyfta om inget med hög AI-relevans finns i ditt
                eget område.
              </p>
            </div>
            <div className="flex flex-col gap-3">{otherTopArticles.map(card)}</div>
          </section>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}

function sortByScoreThenDate(a: Article, b: Article) {
  if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
  return (b.scored_at ?? "").localeCompare(a.scored_at ?? "");
}

const CHECKLIST_ITEMS = [
  "Bakgrund och knowledge gap",
  "Forskningsfråga och studiedesign (PICO)",
  "Patientpopulation",
  "Primärt resultat (HR, CI, p-värde)",
  "Sekundära endpoints och subgrupper",
  "Biverkningsprofil",
  "Styrkor och begränsningar",
  "Klinisk implikation för SÖS-patienter",
  "Tre diskussionsfrågor",
];

function PrepareView({ article, onBack }: { article: Article; onBack: () => void }) {
  const storageKey = `presentation-checklist:${article.url}`;
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const [printIndications, setPrintIndications] = useState(false);
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
    document.title = `Förbered: ${article.title.slice(0, 50)} · ${PRODUCT_NAME}`;
  }, [article.title]);

  const toggle = (i: number) => setChecked((arr) => arr.map((v, idx) => (idx === i ? !v : v)));
  const done = checked.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <main
        id="content"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-6 outline-none sm:py-8 print:max-w-none print:px-0 print:py-0"
      >
        <div className="max-w-3xl print:max-w-none">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="hit-area -ml-2 px-2 text-sm text-ink-2"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka till kandidater
            </Button>
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
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Skriv ut
              </Button>
            </div>
          </div>

          <article className="flex flex-col rounded-md border border-border bg-card px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7 print:rounded-none print:border-0 print:p-0">
            <ArticleHeading article={article} doiInline />
            <ArticleLinks article={article} className="mt-[18px] print:hidden" />
            <AiSections article={article} />
            <RegulatorySection
              reg={article.regulatory}
              printIndications={printIndications}
              className="mt-7 border-t border-border pt-6"
            />
          </article>

          <section className="mt-4 rounded-md border border-border bg-card px-5 py-6 sm:px-8 print:mt-8 print:rounded-none print:border-0 print:p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.01em]">
                Checklista för 15 minuter journal club
              </h2>
              <p className="text-meta text-muted-foreground print:hidden" aria-live="polite">
                {done} av {CHECKLIST_ITEMS.length} klara
                {done > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setChecked(CHECKLIST_ITEMS.map(() => false))}
                      className="hit-area font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Börja om
                    </button>
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
              Sparas automatiskt i den här webbläsaren.
            </p>
            <ul className="mt-4 space-y-1">
              {CHECKLIST_ITEMS.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Checkbox
                    id={`chk-${i}`}
                    checked={checked[i]}
                    onCheckedChange={() => toggle(i)}
                    className="mt-2.5 print:hidden"
                  />
                  <span className="mt-1.5 hidden h-4 w-4 shrink-0 rounded-sm border border-foreground print:inline-block" />
                  <label
                    htmlFor={`chk-${i}`}
                    className={cn(
                      "flex-1 cursor-pointer py-1.5 text-sm leading-relaxed",
                      checked[i] &&
                        "text-muted-foreground line-through print:text-foreground print:no-underline",
                    )}
                  >
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
