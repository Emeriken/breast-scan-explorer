import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronDown,
  Search,
  Star,
  ExternalLink,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/NavTabs";
import { categoryColor, externalLinkProps } from "@/lib/categories";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { MeshTags } from "@/components/MeshTags";
import { pmidFromUrl, journalLevel, parsePubDate } from "@/lib/journals";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { DisclaimerFooter } from "@/components/Footer";

export const DATA_URL =
  "https://raw.githubusercontent.com/Emeriken/brostcancer-publik/main/public-index.json";

export type DeepAnalysis = {
  central_finding?: string;
  limitation?: string;
  vs_standard?: string;
  applicability?: string;
} | null;

export type Article = {
  title: string;
  journal: string;
  pub_date: string;
  authors?: string | string[];
  url: string;
  doi?: string;
  mesh_terms?: string[];
  relevance_score: number;
  category: string;
  why_relevant: string;
  deep_analysis: DeepAnalysis;
  scored_at: string;
};

export type ApiResponse = {
  updated?: string;
  article_count?: number;
  journals_tracked?: string[] | number;
  categories?: string[];
  articles: Article[];
};

type SortKey = "scored_at" | "pub_date" | "score" | "journal";

export async function fetchArticles(): Promise<ApiResponse> {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kunde inte hämta data (HTTP ${res.status})`);
  return res.json();
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PubDateDisplay({ pubDate }: { pubDate?: string }) {
  if (!pubDate) return null;
  const ms = parsePubDate(pubDate);
  const isFuture = ms > Date.now() + 30 * 24 * 60 * 60 * 1000;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatDate(pubDate) || pubDate}</span>
      {isFuture && (
        <span
          className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          title="Publiceringsdatum ligger i framtiden — sannolikt redan tillgänglig online som 'ahead of print'"
        >
          Ahead of print
        </span>
      )}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const c = categoryColor(category);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span
        aria-hidden
        className="mr-1.5 inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: c.solid }}
      />
      {category}
    </span>
  );
}

export function Stars({ score }: { score: number }) {
  const n = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`Relevans ${n} av 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < n ? "fill-primary text-primary" : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  trailing,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  trailing?: ReactNode;
}) {
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2 min-w-0 min-h-11">
          <span className="flex items-center gap-2 truncate">
            <Filter className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {trailing}
            {selected.size > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selected.size}
              </Badge>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-2">
          {options.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Inga val tillgängliga</p>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.has(opt)}
                  onCheckedChange={() => toggle(opt)}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))
          )}
        </div>
        {selected.size > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(new Set())}
            >
              Rensa
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function QuickFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-xs font-medium transition-colors min-h-9 sm:min-h-0",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ArticleCard({ article, query }: { article: Article; query: string }) {
  const [open, setOpen] = useState(false);
  const da = article.deep_analysis;
  const hasDeep =
    da &&
    (da.central_finding || da.limitation || da.vs_standard || da.applicability);

  const authors = Array.isArray(article.authors)
    ? article.authors.join(", ")
    : article.authors;

  const pmid = pmidFromUrl(article.url);

  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryTag category={article.category} />
            <Stars score={article.relevance_score} />
          </div>
          <span className="text-xs text-muted-foreground">
            <PubDateDisplay pubDate={article.pub_date} />
          </span>
        </div>

        <h2 className="text-base font-semibold leading-snug sm:text-lg">
          {pmid ? (
            <Link
              to="/article/$pmid"
              params={{ pmid }}
              className="text-foreground hover:text-primary hover:underline"
            >
              <Highlight text={article.title} query={query} />
            </Link>
          ) : (
            <a
              href={article.url}
              {...externalLinkProps}
              className="text-foreground hover:text-primary hover:underline"
            >
              <Highlight text={article.title} query={query} />
              <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-baseline opacity-60" />
            </a>
          )}
        </h2>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">
            <Highlight text={article.journal} query={query} />
          </span>
          <JournalBadge journal={article.journal} />
          {authors && (
            <span className="block text-xs mt-0.5 line-clamp-1">{authors}</span>
          )}
        </div>

        {article.why_relevant && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-foreground/80">
            <span className="font-semibold text-foreground">Motivering: </span>
            <Highlight text={article.why_relevant} query={query} />
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
                className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
              />
              {open ? "Dölj djupanalys" : "Visa djupanalys"}
            </button>
            {open && (
              <>
                <dl className="mt-3 grid gap-3 rounded-lg border border-dashed bg-background p-4 text-sm sm:grid-cols-2">
                  {da?.central_finding && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Centralt fynd
                      </dt>
                      <dd className="mt-1">{da.central_finding}</dd>
                    </div>
                  )}
                  {da?.limitation && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Begränsning
                      </dt>
                      <dd className="mt-1">{da.limitation}</dd>
                    </div>
                  )}
                  {da?.vs_standard && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Jämfört med standard
                      </dt>
                      <dd className="mt-1">{da.vs_standard}</dd>
                    </div>
                  )}
                  {da?.applicability && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Tillämpbarhet
                      </dt>
                      <dd className="mt-1">{da.applicability}</dd>
                    </div>
                  )}
                </dl>
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

        {article.doi && (
          <div className="text-xs text-muted-foreground">
            DOI:{" "}
            <a
              href={`https://doi.org/${article.doi}`}
              {...externalLinkProps}
              className="underline-offset-2 hover:underline"
            >
              {article.doi}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

type QuickFilter = "score5" | "score4plus" | "thisMonth" | "last30" | "l3only";

export function ArticleBrowser() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
    staleTime: 60_000,
  });

  const search = useSearch({ from: "/" }) as { mesh?: string };
  const navigate = useNavigate({ from: "/" });
  const meshFilter = search.mesh ?? "";

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("pub_date");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [journals, setJournals] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Set<string>>(new Set());
  const [quick, setQuick] = useState<Set<QuickFilter>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleQuick = (q: QuickFilter) => {
    const next = new Set(quick);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    setQuick(next);
  };

  const articles = data?.articles ?? [];

  const allCategories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category).filter(Boolean))).sort(),
    [articles],
  );
  const allJournals = useMemo(
    () => Array.from(new Set(articles.map((a) => a.journal).filter(Boolean))).sort(),
    [articles],
  );
  const allScores = ["5", "4", "3", "2", "1"];
  const allLevels = ["L3", "L2", "L1"];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const last30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const meshLower = meshFilter.toLowerCase();
    let list = articles.filter((a) => {
      if (cats.size > 0 && !cats.has(a.category)) return false;
      if (journals.size > 0 && !journals.has(a.journal)) return false;
      if (scores.size > 0 && !scores.has(String(Math.round(a.relevance_score)))) return false;
      if (levels.size > 0) {
        const lvl = journalLevel(a.journal);
        if (lvl === null) return false;
        if (!levels.has(`L${lvl}`)) return false;
      }
      if (quick.has("score5") && Math.round(a.relevance_score) !== 5) return false;
      if (quick.has("score4plus") && a.relevance_score < 4) return false;
      if (quick.has("l3only") && journalLevel(a.journal) !== 3) return false;
      if (quick.has("thisMonth") || quick.has("last30")) {
        const t = a.scored_at ? new Date(a.scored_at).getTime() : NaN;
        if (isNaN(t)) return false;
        if (quick.has("thisMonth") && t < startOfMonth) return false;
        if (quick.has("last30") && t < last30) return false;
      }
      if (meshLower) {
        const terms = (a.mesh_terms ?? []).map((t) =>
          t.replace(/\*$/, "").trim().toLowerCase(),
        );
        if (!terms.includes(meshLower)) return false;
      }
      if (q) {
        const authorsStr = Array.isArray(a.authors)
          ? a.authors.join(" ")
          : (a.authors ?? "");
        const hay =
          `${a.title} ${a.why_relevant} ${a.journal} ${authorsStr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "score":
          return b.relevance_score - a.relevance_score;
        case "pub_date":
          return parsePubDate(b.pub_date) - parsePubDate(a.pub_date);
        case "journal":
          return a.journal.localeCompare(b.journal, "sv");
        case "scored_at":
        default: {
          const cmp = (b.scored_at ?? "").localeCompare(a.scored_at ?? "");
          if (cmp !== 0) return cmp;
          return parsePubDate(b.pub_date) - parsePubDate(a.pub_date);
        }
      }
    });
    return list;
  }, [articles, query, sort, cats, journals, scores, levels, quick, meshFilter]);

  // Detailed filters (the ones inside the collapsible)
  const detailedCount = cats.size + journals.size + scores.size + levels.size;
  const activeFilters =
    detailedCount + quick.size + (query ? 1 : 0) + (meshFilter ? 1 : 0);

  const clearMesh = () =>
    navigate({ search: (prev: { mesh?: string }) => ({ ...prev, mesh: undefined }) });

  const resetAll = () => {
    setCats(new Set());
    setJournals(new Set());
    setScores(new Set());
    setLevels(new Set());
    setQuick(new Set());
    setQuery("");
    clearMesh();
  };

  // Descriptors for the empty-state suggestions
  type Descriptor = { label: string; onClear: () => void };
  const activeDescriptors: Descriptor[] = [];
  if (query)
    activeDescriptors.push({
      label: `Sök: "${query}"`,
      onClear: () => setQuery(""),
    });
  if (meshFilter)
    activeDescriptors.push({
      label: `MeSH: ${meshFilter}`,
      onClear: clearMesh,
    });
  cats.forEach((c) =>
    activeDescriptors.push({
      label: `Kategori: ${c}`,
      onClear: () => {
        const next = new Set(cats);
        next.delete(c);
        setCats(next);
      },
    }),
  );
  journals.forEach((j) =>
    activeDescriptors.push({
      label: `Tidskrift: ${j}`,
      onClear: () => {
        const next = new Set(journals);
        next.delete(j);
        setJournals(next);
      },
    }),
  );
  scores.forEach((s) =>
    activeDescriptors.push({
      label: `Poäng: ${s}`,
      onClear: () => {
        const next = new Set(scores);
        next.delete(s);
        setScores(next);
      },
    }),
  );
  levels.forEach((l) =>
    activeDescriptors.push({
      label: `KI-JL: ${l}`,
      onClear: () => {
        const next = new Set(levels);
        next.delete(l);
        setLevels(next);
      },
    }),
  );
  quick.forEach((q) => {
    const labels: Record<QuickFilter, string> = {
      score5: "Bara 5-poängare",
      score4plus: "Bara 4–5-poängare",
      thisMonth: "Denna månad",
      last30: "Senaste 30 dagarna",
      l3only: "Endast L3-tidskrifter",
    };
    activeDescriptors.push({
      label: labels[q],
      onClear: () => toggleQuick(q),
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
          <div className="mb-4">
            <NavTabs />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Bröstcancerartiklar
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-driven litteraturöversikt · SÖS Onkologen
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Uppdatera
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{filtered.length}</strong> av{" "}
              <strong className="text-foreground">{articles.length}</strong> artiklar
            </span>
            {data?.updated && (
              <span>Senast uppdaterad: {formatDate(data.updated)}</span>
            )}
            {data?.journals_tracked && (
              <span>
                {Array.isArray(data.journals_tracked)
                  ? data.journals_tracked.length
                  : data.journals_tracked}{" "}
                tidskrifter bevakade
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="sticky top-0 z-10 -mx-4 mb-6 border-b bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:p-4 sm:shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="article-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök i titel, motivering eller tidskrift… (Tryck / för att söka)"
                className="pl-9"
              />
            </div>

            {meshFilter && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
                <span>
                  Filtrerar på MeSH-term:{" "}
                  <strong className="font-semibold">{meshFilter}</strong>
                </span>
                <button
                  onClick={clearMesh}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-muted"
                  aria-label="Rensa MeSH-filter"
                >
                  <X className="h-3 w-3" /> Rensa
                </button>
              </div>
            )}

            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <div className="flex flex-wrap items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                    {detailedCount > 0 && (
                      <Badge variant="secondary">{detailedCount}</Badge>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        filtersOpen && "rotate-180",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-9 min-w-0 max-w-[200px]">
                    <SelectValue placeholder="Sortering" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scored_at">Senast bedömd av AI</SelectItem>
                    <SelectItem value="pub_date">Publiceringsdatum</SelectItem>
                    <SelectItem value="score">Högsta poäng</SelectItem>
                    <SelectItem value="journal">Tidskrift (A–Ö)</SelectItem>
                  </SelectContent>
                </Select>
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAll}
                    className="ml-auto"
                  >
                    Rensa filter ({activeFilters})
                  </Button>
                )}
              </div>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <MultiSelect
                    label="Kategori"
                    options={allCategories}
                    selected={cats}
                    onChange={setCats}
                  />
                  <MultiSelect
                    label="Tidskrift"
                    options={allJournals}
                    selected={journals}
                    onChange={setJournals}
                  />
                  <MultiSelect
                    label="Poäng"
                    options={allScores}
                    selected={scores}
                    onChange={setScores}
                  />
                  <MultiSelect
                    label="KI-JL-nivå"
                    options={allLevels}
                    selected={levels}
                    onChange={setLevels}
                    trailing={<KiJlInfoTooltip />}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <QuickFilterButton
            active={quick.has("score5")}
            onClick={() => toggleQuick("score5")}
          >
            Bara 5-poängare
          </QuickFilterButton>
          <QuickFilterButton
            active={quick.has("score4plus")}
            onClick={() => toggleQuick("score4plus")}
          >
            Bara 4–5-poängare
          </QuickFilterButton>
          <QuickFilterButton
            active={quick.has("thisMonth")}
            onClick={() => toggleQuick("thisMonth")}
          >
            Denna månad
          </QuickFilterButton>
          <QuickFilterButton
            active={quick.has("last30")}
            onClick={() => toggleQuick("last30")}
          >
            Senaste 30 dagarna
          </QuickFilterButton>
          <QuickFilterButton
            active={quick.has("l3only")}
            onClick={() => toggleQuick("l3only")}
          >
            Endast L3-tidskrifter
          </QuickFilterButton>
          {activeFilters > 0 && (
            <button
              onClick={resetAll}
              className="ml-auto rounded-full border border-dashed border-input px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Återställ alla filter
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border bg-card"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-semibold text-destructive">
              Kunde inte ladda artiklar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(error as Error).message}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              Försök igen
            </Button>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 sm:p-8">
            <p className="font-medium">Inga artiklar matchar dina filter.</p>
            {activeDescriptors.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prova att slå av:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDescriptors.map((d, i) => (
                    <button
                      key={i}
                      onClick={d.onClear}
                      className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-xs hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                      {d.label}
                    </button>
                  ))}
                  <button
                    onClick={resetAll}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    Återställ alla
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Inga artiklar i datakällan ännu.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((a, i) => (
            <ArticleCard key={`${a.url}-${i}`} article={a} query={query} />
          ))}
        </div>
      </main>

      <DisclaimerFooter />
    </div>
  );
}
