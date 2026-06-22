import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Printer,
  ArrowLeft,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/NavTabs";
import {
  fetchArticles,
  CategoryTag,
  Stars,
  PubDateDisplay,
  type Article,
} from "@/components/ArticleBrowser";
import { DisclaimerFooter } from "@/components/Footer";
import { JournalBadge } from "@/components/JournalBadge";
import { MeshTags } from "@/components/MeshTags";
import { pmidFromUrl } from "@/lib/journals";

type TreatmentKey = "cytotoxisk" | "endokrin" | "stralbehandling";

const TREATMENTS: { key: TreatmentKey; label: string; match: RegExp }[] = [
  {
    key: "cytotoxisk",
    label: "Cytotoxisk behandling",
    match: /(cytotox|kemo|chemo)/i,
  },
  {
    key: "endokrin",
    label: "Endokrin behandling",
    match: /(endokrin|endocrine|hormon)/i,
  },
  {
    key: "stralbehandling",
    label: "Strålbehandling",
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
  prepare: z.string().optional(),
});

export const Route = createFileRoute("/manadens-artikel")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Månadens artikel — presentationskandidater" },
      {
        name: "description",
        content:
          "Välj kandidatartiklar för månadens journal club-presentation och förbered checklistan.",
      },
    ],
  }),
  component: ManadensArtikel,
});

function parseScoredAt(iso: string): { y: number; m: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ManadensArtikel() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data, isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
    staleTime: 60_000,
  });

  const articles = data?.articles ?? [];

  // Latest month with data
  const latest = useMemo(() => {
    let best: { y: number; m: number } | null = null;
    for (const a of articles) {
      const p = parseScoredAt(a.scored_at);
      if (!p) continue;
      if (!best || p.y > best.y || (p.y === best.y && p.m > best.m)) best = p;
    }
    return best;
  }, [articles]);

  const now = new Date();
  const defaultYear = latest?.y ?? now.getFullYear();
  const defaultMonth = latest?.m ?? now.getMonth() + 1;
  const defaultTreatment: TreatmentKey = "cytotoxisk";

  const month = search.month ?? defaultMonth;
  const year = search.year ?? defaultYear;
  const treatment = (search.treatment ?? defaultTreatment) as TreatmentKey;

  const setSearch = (next: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...next }) });

  const treatmentDef = TREATMENTS.find((t) => t.key === treatment)!;

  const monthCandidates = useMemo(() => {
    return articles.filter((a) => {
      const p = parseScoredAt(a.scored_at);
      if (!p) return false;
      if (p.y !== year || p.m !== month) return false;
      return treatmentDef.match.test(a.category || "");
    });
  }, [articles, year, month, treatmentDef]);

  const top = monthCandidates
    .filter((a) => a.relevance_score >= 4)
    .sort(sortByScoreThenDate);
  const fallback = monthCandidates
    .filter((a) => Math.round(a.relevance_score) === 3)
    .sort(sortByScoreThenDate);

  const useFallback = top.length === 0 && fallback.length > 0;
  const list = top.length > 0 ? top : fallback;

  // Prepare mode
  const prepareArticle = useMemo(
    () =>
      search.prepare
        ? articles.find((a) => a.url === search.prepare) ?? null
        : null,
    [search.prepare, articles],
  );

  if (prepareArticle) {
    return (
      <PrepareView
        article={prepareArticle}
        onBack={() => setSearch({ prepare: undefined })}
      />
    );
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
          <div className="mb-4">
            <NavTabs />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Månadens artikel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Presentationskandidater för journal club — 15 minuter.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Månad</span>
              <select
                value={month}
                onChange={(e) =>
                  setSearch({ month: Number(e.target.value) })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MONTHS_SV.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">År</span>
              <select
                value={year}
                onChange={(e) =>
                  setSearch({ year: Number(e.target.value) })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = now.getFullYear() - 4 + i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="text-sm sm:col-span-1">
              <span className="mb-1 block font-medium">Behandlingsområde</span>
              <div className="flex flex-col gap-1.5">
                {TREATMENTS.map((t) => (
                  <label
                    key={t.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 hover:bg-accent"
                  >
                    <input
                      type="radio"
                      name="treatment"
                      value={t.key}
                      checked={treatment === t.key}
                      onChange={() => setSearch({ treatment: t.key })}
                      className="accent-primary"
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSearch({ year: prev.year, month: prev.month })
              }
            >
              <ChevronLeft className="h-4 w-4" />
              {MONTHS_SV[prev.month - 1]} {prev.year}
            </Button>
            <span className="font-medium">
              {MONTHS_SV[month - 1]} {year}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSearch({ year: next.year, month: next.month })
              }
            >
              {MONTHS_SV[next.month - 1]} {next.year}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mt-6">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border bg-card"
                />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
              Kunde inte ladda artiklar: {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && list.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">
                Inga kandidater för {MONTHS_SV[month - 1]} {year}.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Inga artiklar i kategorin {treatmentDef.label.toLowerCase()}{" "}
                bedömdes denna månad. Prova en annan månad eller kategori.
              </p>
            </div>
          )}

          {!isLoading && !error && list.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {useFallback ? "3-poängare" : "Topprekommendation"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({list.length})
                  </span>
                </h2>
              </div>
              {useFallback && (
                <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Inga toppartiklar denna månad — visar 3-poängare istället.
                </div>
              )}
              <div className="space-y-4">
                {list.map((a, i) => (
                  <CandidateCard
                    key={`${a.url}-${i}`}
                    article={a}
                    onPrepare={() => setSearch({ prepare: a.url })}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <DisclaimerFooter />
    </div>
  );
}

function sortByScoreThenDate(a: Article, b: Article) {
  if (b.relevance_score !== a.relevance_score)
    return b.relevance_score - a.relevance_score;
  return (b.scored_at ?? "").localeCompare(a.scored_at ?? "");
}

function ArticleTitleLink({ article }: { article: Article }) {
  const pmid = pmidFromUrl(article.url);
  if (pmid) {
    return (
      <Link
        to="/article/$pmid"
        params={{ pmid }}
        className="text-foreground hover:text-primary hover:underline"
      >
        {article.title}
      </Link>
    );
  }
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground hover:text-primary hover:underline"
    >
      {article.title}
      <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-baseline opacity-60" />
    </a>
  );
}

function CandidateCard({
  article,
  onPrepare,
}: {
  article: Article;
  onPrepare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const da = article.deep_analysis;
  const hasDeep =
    da &&
    (da.central_finding || da.limitation || da.vs_standard || da.applicability);

  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryTag category={article.category} />
            <Stars score={article.relevance_score} />
            <Badge variant="secondary">
              Relevans {Math.round(article.relevance_score)}/5
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            <PubDateDisplay pubDate={article.pub_date} />
          </span>
        </div>

        <h3 className="text-base font-semibold leading-snug sm:text-lg">
          <ArticleTitleLink article={article} />
        </h3>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {article.journal}
          </span>
          <JournalBadge journal={article.journal} />
        </div>

        {article.why_relevant && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-foreground/80">
            <span className="font-semibold text-foreground">Motivering: </span>
            {article.why_relevant}
          </p>
        )}

        {hasDeep && (
          <div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              aria-expanded={open}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180",
                )}
              />
              {open ? "Dölj djupanalys" : "Visa djupanalys"}
            </button>
            {open && (
              <>
                <DeepAnalysisGrid da={da!} />
                {article.mesh_terms && article.mesh_terms.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      MeSH-termer
                    </p>
                    <MeshTags terms={article.mesh_terms} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onPrepare}>
            <Presentation className="h-4 w-4" />
            Förbered presentation
          </Button>
          <Button asChild variant="outline">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              Öppna i PubMed
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function DeepAnalysisGrid({
  da,
}: {
  da: NonNullable<Article["deep_analysis"]>;
}) {
  const items: [string, string | undefined][] = [
    ["Centralt fynd", da.central_finding],
    ["Begränsning", da.limitation],
    ["Jämfört med standard", da.vs_standard],
    ["Tillämpbarhet", da.applicability],
  ];
  return (
    <dl className="mt-3 grid gap-3 rounded-lg border border-dashed bg-background p-4 text-sm sm:grid-cols-2">
      {items.map(
        ([k, v]) =>
          v && (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {k}
              </dt>
              <dd className="mt-1">{v}</dd>
            </div>
          ),
      )}
    </dl>
  );
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

function PrepareView({
  article,
  onBack,
}: {
  article: Article;
  onBack: () => void;
}) {
  const storageKey = `presentation-checklist:${article.url}`;
  const [checked, setChecked] = useState<boolean[]>(() =>
    CHECKLIST_ITEMS.map(() => false),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === CHECKLIST_ITEMS.length) {
          setChecked(parsed.map(Boolean));
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // ignore
    }
  }, [storageKey, checked]);

  const toggle = (i: number) =>
    setChecked((arr) => arr.map((v, idx) => (idx === i ? !v : v)));

  const authors = Array.isArray(article.authors)
    ? article.authors.join(", ")
    : article.authors;

  const da = article.deep_analysis;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till kandidater
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Skriv ut
          </Button>
        </div>

        <article className="rounded-xl border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CategoryTag category={article.category} />
            <Stars score={article.relevance_score} />
            <Badge variant="secondary">
              Relevans {Math.round(article.relevance_score)}/5
            </Badge>
          </div>
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {article.title}
            </a>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {article.journal}
            </span>{" "}
            · <PubDateDisplay pubDate={article.pub_date} />
            {article.doi && <span> · DOI: {article.doi}</span>}
          </p>
          {authors && (
            <p className="mt-1 text-xs text-muted-foreground">{authors}</p>
          )}

          {article.why_relevant && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Motivering
              </h2>
              <p className="mt-1 text-sm">{article.why_relevant}</p>
            </div>
          )}

          {da &&
            (da.central_finding ||
              da.limitation ||
              da.vs_standard ||
              da.applicability) && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Djupanalys
                </h2>
                <DeepAnalysisGrid da={da} />
              </div>
            )}
        </article>

        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm print:mt-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="text-lg font-semibold">
            Checklista — 15 minuter journal club
          </h2>
          <p className="mt-1 text-xs text-muted-foreground print:hidden">
            Sparas automatiskt i den här webbläsaren.
          </p>
          <ul className="mt-4 space-y-3">
            {CHECKLIST_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <Checkbox
                  id={`chk-${i}`}
                  checked={checked[i]}
                  onCheckedChange={() => toggle(i)}
                  className="mt-0.5 print:hidden"
                />
                <span className="hidden h-4 w-4 shrink-0 rounded-sm border border-foreground print:inline-block" />
                <label
                  htmlFor={`chk-${i}`}
                  className={cn(
                    "text-sm leading-relaxed",
                    checked[i] && "line-through text-muted-foreground print:no-underline print:text-foreground",
                  )}
                >
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}