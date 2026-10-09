import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronDown,
  Search,
  Star,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { categoryColor, externalLinkProps } from "@/lib/categories";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { MeshTags } from "@/components/MeshTags";
import { pmidFromUrl, journalLevel, parsePubDate, formatPubDate } from "@/lib/journals";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { DisclaimerFooter } from "@/components/Footer";
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  SORT_KEYS,
  SORT_LABELS,
  type ArticleSearch,
  type SortKey,
} from "@/lib/article-search";
import { useNewArticles } from "@/hooks/use-new-articles";

export const DATA_URL =
  "https://raw.githubusercontent.com/Emeriken/brostcancer-publik/main/public-index.json";

export type DeepAnalysis = {
  central_finding?: string;
  limitation?: string;
  vs_standard?: string;
  applicability?: string;
} | null;

export type Article = {
  pmid?: string;
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

export async function fetchArticles(): Promise<ApiResponse> {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kunde inte hämta data (HTTP ${res.status})`);
  return res.json();
}

/**
 * Gemensam fråga för alla vyer. Datafilen ändras sällan, så den hämtas inte
 * om vid varje flikbyte eller fokusbyte. Knappen Uppdatera hämtar alltid färskt.
 */
export const articlesQueryOptions = queryOptions({
  queryKey: ["articles"],
  queryFn: fetchArticles,
  staleTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
});

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
      <span>{formatPubDate(pubDate)}</span>
      {isFuture && (
        <span
          className="rounded-sm border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
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
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: c.solid }}
      />
      {category}
    </span>
  );
}

export function Stars({ score }: { score: number }) {
  const n = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Relevans ${n} av 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            "h-3.5 w-3.5",
            i < n
              ? "fill-amber-500 text-amber-500"
              : "text-muted-foreground/25",
          )}
        />
      ))}
    </div>
  );
}

function articleId(a: Article) {
  return a.pmid ?? a.url;
}

/** Datum som "ÅÅÅÅ-MM-DD" i lokal tid, jämförbart med scored_at som sträng. */
function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type SegmentOption<T> = { value: T; label: string };

function Segmented<T extends string | number | undefined>({
  label,
  value,
  options,
  onChange,
  info,
  fill,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  info?: ReactNode;
  fill?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", fill && "w-full")}>
      <span className="flex h-6 items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {info}
      </span>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "inline-flex h-9 rounded-md border border-border bg-background p-0.5",
          fill && "flex w-full",
        )}
      >
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "whitespace-nowrap rounded-[5px] px-3 text-xs font-medium transition-colors",
                fill && "flex-1",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  fill,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (s: string[]) => void;
  fill?: boolean;
}) {
  const selectedSet = new Set(selected);
  const toggle = (v: string) => {
    const next = new Set(selectedSet);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(options.filter((o) => next.has(o)));
  };
  return (
    <div className={cn("flex flex-col gap-1", fill && "w-full")}>
      <span className="flex h-6 items-center text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("h-9 min-w-[9rem] justify-between gap-2 font-normal", fill && "w-full")}
          >
            <span className="truncate">
              {selected.length === 0
                ? "Alla"
                : selected.length === 1
                  ? selected[0]
                  : `${selected.length} valda`}
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
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedSet.has(opt)}
                    onCheckedChange={() => toggle(opt)}
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChange([])}
              >
                Rensa {label.toLowerCase()}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterControls({
  search,
  update,
  categories,
  journals,
  variant,
}: {
  search: ArticleSearch;
  update: (patch: Partial<ArticleSearch>) => void;
  categories: string[];
  journals: string[];
  variant: "inline" | "sheet";
}) {
  const fill = variant === "sheet";
  const row = fill ? "contents" : "flex flex-wrap items-end gap-x-4 gap-y-3";
  return (
    <div className={cn(fill ? "flex flex-col gap-4" : "flex flex-col gap-3")}>
      <div className={row}>
        <Segmented
          label="Relevans"
          value={search.min}
          options={[
            { value: undefined, label: "Alla" },
            { value: 4, label: "4–5" },
            { value: 5, label: "5" },
          ]}
          onChange={(v) => update({ min: v })}
          fill={fill}
        />
        <Segmented
          label="Bedömd"
          value={search.period}
          options={[
            { value: undefined, label: "Alla" },
            { value: "month", label: "Denna månad" },
            { value: "30d", label: "30 dagar" },
          ]}
          onChange={(v) => update({ period: v })}
          fill={fill}
        />
        <Segmented
          label="Tidskriftsnivå"
          info={<KiJlInfoTooltip />}
          value={search.level}
          options={[
            { value: undefined, label: "Alla" },
            { value: 2, label: "L2–L3" },
            { value: 3, label: "L3" },
          ]}
          onChange={(v) => update({ level: v })}
          fill={fill}
        />
      </div>
      <div className={row}>
        <MultiSelect
          label="Kategori"
          options={categories}
          selected={search.cat ?? []}
          onChange={(v) => update({ cat: v.length ? v : undefined })}
          fill={fill}
        />
        <MultiSelect
          label="Tidskrift"
          options={journals}
          selected={search.journal ?? []}
          onChange={(v) => update({ journal: v.length ? v : undefined })}
          fill={fill}
        />
        <div className={cn("flex flex-col gap-1", fill && "w-full")}>
          <span className="flex h-6 items-center text-xs font-medium text-muted-foreground">
            Sortering
          </span>
          <Select
            value={search.sort ?? DEFAULT_SORT}
            onValueChange={(v) =>
              update({ sort: v === DEFAULT_SORT ? undefined : (v as SortKey) })
            }
          >
            <SelectTrigger className={cn("h-9", fill ? "w-full" : "w-[11.5rem]")} aria-label="Sortering">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  query,
  isNew,
}: {
  article: Article;
  query: string;
  isNew: boolean;
}) {
  const [open, setOpen] = useState(false);
  const da = article.deep_analysis;
  const hasDeep =
    da &&
    (da.central_finding || da.limitation || da.vs_standard || da.applicability);

  const authors = Array.isArray(article.authors)
    ? article.authors.join(", ")
    : article.authors;

  const pmid = article.pmid ?? pmidFromUrl(article.url);

  return (
    <article className="rounded-lg border border-neutral-200/70 bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.06)] transition-all duration-200 hover:border-neutral-300 hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-background">
                Ny
              </span>
            )}
            <CategoryTag category={article.category} />
            <Stars score={article.relevance_score} />
          </div>
          <span className="text-xs text-muted-foreground">
            <PubDateDisplay pubDate={article.pub_date} />
          </span>
        </div>

        <h2 className="text-base font-semibold leading-[1.35] tracking-[-0.01em] sm:text-lg">
          {pmid ? (
            <Link
              to="/article/$pmid"
              params={{ pmid }}
              className="text-foreground hover:underline"
            >
              <Highlight text={article.title} query={query} />
            </Link>
          ) : (
            <a
              href={article.url}
              {...externalLinkProps}
              className="text-foreground hover:underline"
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
            <span className="mt-0.5 block line-clamp-1 text-xs">
              <Highlight text={authors} query={query} />
            </span>
          )}
        </div>

        {article.why_relevant && (
          <p className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm text-foreground/80">
            <span className="font-semibold text-foreground">Motivering: </span>
            <Highlight text={article.why_relevant} query={query} />
          </p>
        )}

        {hasDeep && (
          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground hover:underline"
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

export function ArticleBrowser() {
  const { data, isLoading, error, refetch, isFetching } = useQuery(articlesQueryOptions);

  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });

  /** Uppdatera URL:en utan ny historikpost och utan att hoppa till toppen. */
  const update = (patch: Partial<ArticleSearch>) =>
    navigate({
      search: (prev: ArticleSearch) => ({ ...prev, n: undefined, ...patch }),
      replace: true,
      resetScroll: false,
    });

  // Sökfältet uppdateras direkt medan URL:en (och därmed filtreringen)
  // uppdateras först när man slutat skriva en kort stund.
  const [queryInput, setQueryInput] = useState(search.q ?? "");
  const lastPushedQuery = useRef(search.q ?? "");
  useEffect(() => {
    const urlQuery = search.q ?? "";
    if (urlQuery !== lastPushedQuery.current) {
      lastPushedQuery.current = urlQuery;
      setQueryInput(urlQuery);
    }
  }, [search.q]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = queryInput.trim();
      if (next !== lastPushedQuery.current) {
        lastPushedQuery.current = next;
        update({ q: next || undefined });
      }
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const articles = useMemo(() => data?.articles ?? [], [data]);
  const ids = useMemo(() => articles.map(articleId), [articles]);
  const newIds = useNewArticles(ids);

  const allCategories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category).filter(Boolean))).sort(),
    [articles],
  );
  const allJournals = useMemo(
    () => Array.from(new Set(articles.map((a) => a.journal).filter(Boolean))).sort(),
    [articles],
  );

  const appliedQuery = search.q ?? "";
  const sort = search.sort ?? DEFAULT_SORT;

  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    const cats = new Set(search.cat ?? []);
    const journals = new Set(search.journal ?? []);
    const now = new Date();
    const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const last30Start = isoDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const meshLower = (search.mesh ?? "").toLowerCase();

    const list = articles.filter((a) => {
      if (cats.size > 0 && !cats.has(a.category)) return false;
      if (journals.size > 0 && !journals.has(a.journal)) return false;
      if (search.min && Math.round(a.relevance_score) < search.min) return false;
      if (search.level) {
        const lvl = journalLevel(a.journal);
        if (lvl === null || lvl < search.level) return false;
      }
      if (search.period) {
        const scored = (a.scored_at ?? "").slice(0, 10);
        if (!scored) return false;
        if (search.period === "month" && scored < monthStart) return false;
        if (search.period === "30d" && scored < last30Start) return false;
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

    return [...list].sort((a, b) => {
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
  }, [articles, appliedQuery, sort, search.cat, search.journal, search.min, search.level, search.period, search.mesh]);

  const shown = Math.max(PAGE_SIZE, search.n ?? PAGE_SIZE);
  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - visible.length;
  const newCount = useMemo(
    () => articles.filter((a) => newIds.has(articleId(a))).length,
    [articles, newIds],
  );

  const journalsTracked = Array.isArray(data?.journals_tracked)
    ? data.journals_tracked.length
    : data?.journals_tracked;

  // Aktiva filter, som chips i tomläget och som räknare
  type Chip = { label: string; clear: () => void };
  const chips: Chip[] = [];
  if (search.q) chips.push({ label: `Sök: "${search.q}"`, clear: () => update({ q: undefined }) });
  if (search.mesh)
    chips.push({ label: `MeSH: ${search.mesh}`, clear: () => update({ mesh: undefined }) });
  for (const c of search.cat ?? [])
    chips.push({
      label: `Kategori: ${c}`,
      clear: () => {
        const rest = (search.cat ?? []).filter((x) => x !== c);
        update({ cat: rest.length ? rest : undefined });
      },
    });
  for (const j of search.journal ?? [])
    chips.push({
      label: `Tidskrift: ${j}`,
      clear: () => {
        const rest = (search.journal ?? []).filter((x) => x !== j);
        update({ journal: rest.length ? rest : undefined });
      },
    });
  if (search.min)
    chips.push({
      label: search.min === 5 ? "Relevans 5" : "Relevans 4–5",
      clear: () => update({ min: undefined }),
    });
  if (search.period)
    chips.push({
      label: search.period === "month" ? "Bedömd denna månad" : "Bedömd senaste 30 dagarna",
      clear: () => update({ period: undefined }),
    });
  if (search.level)
    chips.push({
      label: search.level === 3 ? "Tidskriftsnivå L3" : "Tidskriftsnivå L2–L3",
      clear: () => update({ level: undefined }),
    });
  const filterCount = chips.length;

  const resetAll = () =>
    navigate({
      search: (prev: ArticleSearch) => ({ sort: prev.sort }),
      replace: true,
      resetScroll: false,
    });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
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
              aria-label="Uppdatera"
              title="Hämta senaste datan"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Uppdatera</span>
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data && <span>{articles.length} artiklar</span>}
            {data?.updated && <span>Senast uppdaterad: {formatDate(data.updated)}</span>}
            {journalsTracked ? <span>{journalsTracked} tidskrifter bevakade</span> : null}
            {newCount > 0 && (
              <span className="font-medium text-foreground">
                {newCount} {newCount === 1 ? "ny" : "nya"} sedan förra besöket
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-6 sm:rounded-lg sm:border sm:border-border/70 sm:bg-card sm:p-4 sm:shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="article-search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Sök titel, författare, tidskrift, motivering"
                aria-label="Sök bland artiklarna"
                className="h-9 rounded-md border-border pl-9 shadow-inner focus-visible:border-foreground/40 sm:pr-10"
              />
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:block"
                title="Tryck / för att söka"
              >
                /
              </kbd>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9 shrink-0 gap-1.5 sm:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                  {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter och sortering</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterControls
                    search={search}
                    update={update}
                    categories={allCategories}
                    journals={allJournals}
                    variant="sheet"
                  />
                </div>
                <div className="mt-6 flex gap-2">
                  {filterCount > 0 && (
                    <Button variant="outline" className="flex-1" onClick={resetAll}>
                      Rensa filter
                    </Button>
                  )}
                  <SheetClose asChild>
                    <Button className="flex-1">
                      Visa {filtered.length} {filtered.length === 1 ? "artikel" : "artiklar"}
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="mt-3 hidden sm:block">
            <FilterControls
              search={search}
              update={update}
              categories={allCategories}
              journals={allJournals}
              variant="inline"
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground sm:mt-3">
            <span aria-live="polite">
              {data ? (
                <>
                  <strong className="text-foreground">{filtered.length}</strong> av{" "}
                  {articles.length} artiklar
                </>
              ) : (
                " "
              )}
            </span>
            {filterCount > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="min-h-8 font-medium text-foreground underline-offset-2 hover:underline"
              >
                Rensa filter ({filterCount})
              </button>
            )}
          </div>
        </div>

        {search.mesh && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
            <span>
              Filtrerar på MeSH-term: <strong className="font-semibold">{search.mesh}</strong>
            </span>
            <button
              type="button"
              onClick={() => update({ mesh: undefined })}
              className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-full px-2 hover:bg-muted"
              aria-label="Rensa MeSH-filter"
            >
              <X className="h-3 w-3" /> Rensa
            </button>
          </div>
        )}

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
            {chips.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prova att slå av:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={c.clear}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-input bg-background px-3 text-xs hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                      {c.label}
                    </button>
                  ))}
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
          {visible.map((a) => (
            <ArticleCard
              key={articleId(a)}
              article={a}
              query={appliedQuery}
              isNew={newIds.has(articleId(a))}
            />
          ))}
        </div>

        {remaining > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button
              variant="outline"
              onClick={() => update({ n: shown + PAGE_SIZE })}
            >
              Visa {Math.min(PAGE_SIZE, remaining)} till
            </Button>
            <p className="text-xs text-muted-foreground">
              Visar {visible.length} av {filtered.length}
            </p>
          </div>
        )}
      </main>

      <DisclaimerFooter />
    </div>
  );
}
