import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisclaimerFooter } from "@/components/Footer";
import { ErrorState } from "@/components/ErrorState";
import { Legend } from "@/components/Legend";
import { ArticleCard } from "@/components/list/ArticleCard";
import { ArticleRows, RowHeader } from "@/components/list/ArticleRow";
import { LowRelevanceRows } from "@/components/list/LowRelevanceRows";
import { StatusBar } from "@/components/list/StatusBar";
import { Toolbar } from "@/components/list/Toolbar";
import { ViewToggle } from "@/components/list/ViewToggle";
import { filterChips } from "@/components/list/filterChips";
import { DEFAULT_SORT, PAGE_SIZE, type ArticleSearch } from "@/lib/article-search";
import {
  articleId,
  articlesQueryOptions,
  dataAge,
  formatDay,
  isoWeek,
  type Article,
} from "@/lib/articles";
import {
  batchOf,
  groupByBatch,
  latestBatchKey,
  listArticles,
  scoreOf,
  type Batch,
} from "@/lib/article-list";
import { useListView } from "@/lib/list-view";
import { SEARCHED_FIELDS, parseQuery, withoutTerm } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Veckans namn, t.ex. "Vecka 42", eller datumet om veckan inte går att räkna ut. */
function weekLabel(key: string): string {
  const w = key ? isoWeek(key) : null;
  return w ? `Vecka ${w}` : key ? `Tillagda ${formatDay(key)}` : "Okänt datum";
}

/**
 * Rubrik för en vecka: "Vecka 42 tillagda mån 12 okt." med antal. På mobil
 * står datumet och antalet på en egen rad under.
 */
function BatchHeader({
  batch,
  isLatest,
  collapsed,
  onToggle,
  showTop,
}: {
  batch: Batch;
  isLatest: boolean;
  collapsed: boolean;
  onToggle: () => void;
  /** Antalet med AI-relevans 4–5. Döljs när listan redan är filtrerad på AI-relevans. */
  showTop: boolean;
}) {
  const top = batch.items.filter((a) => scoreOf(a) >= 4).length;
  const week = batch.key ? isoWeek(batch.key) : null;
  const day = batch.key ? formatDay(batch.key) : null;
  return (
    <div className="mb-3 flex flex-col gap-0.5 border-b border-border pb-2.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-1">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="hit-area inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm text-left hover:text-foreground/80"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          {weekLabel(batch.key)}
          {week && day && (
            <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
              tillagda {day}
            </span>
          )}
          {isLatest && (
            <span className="inline-flex h-5 items-center rounded-sm bg-foreground px-1.5 text-xs font-semibold leading-4 text-background">
              Senaste
            </span>
          )}
        </button>
      </h2>
      <p className="ml-6 text-meta text-muted-foreground sm:ml-0">
        {week && day && <span className="whitespace-nowrap sm:hidden">Tillagda {day} · </span>}
        <span className="whitespace-nowrap">
          {batch.items.length} {batch.items.length === 1 ? "artikel" : "artiklar"}
        </span>
        {showTop && top > 0 && (
          <span className="whitespace-nowrap"> · {top} med AI-relevans 4–5</span>
        )}
      </p>
    </div>
  );
}

export function ArticleBrowser() {
  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);

  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });

  /** Uppdatera URL:en utan ny historikpost och utan att hoppa till toppen. */
  const update = (patch: Partial<ArticleSearch>) =>
    navigate({
      search: (prev: ArticleSearch) => ({ ...prev, n: undefined, ...patch }),
      replace: true,
      resetScroll: false,
    });

  const resetAll = () =>
    navigate({
      search: (prev: ArticleSearch) => ({ sort: prev.sort }),
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
  const latest = useMemo(() => latestBatchKey(articles), [articles]);
  const query = useMemo(() => parseQuery(search.q), [search.q]);

  const allCategories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category).filter(Boolean))).sort(),
    [articles],
  );
  const allJournals = useMemo(
    () => Array.from(new Set(articles.map((a) => a.journal).filter(Boolean))).sort(),
    [articles],
  );

  const filtered = useMemo(
    () => listArticles(articles, search, { latest, query }),
    [articles, search, latest, query],
  );

  const sort = search.sort ?? DEFAULT_SORT;
  const grouped = sort === "scored_at";
  // Veckovis triage: 1–2 fälls ihop till rader, så länge man inte söker efter
  // något särskilt eller redan filtrerat på AI-relevans.
  const triage = grouped && !query && !search.min && !search.score;

  const shown = Math.max(PAGE_SIZE, search.n ?? PAGE_SIZE);
  const { batches, visibleCount } = useMemo(() => {
    if (!grouped) return { batches: [] as Batch[], visibleCount: Math.min(shown, filtered.length) };
    // Hela veckor åt gången, tills minst `shown` artiklar visas
    const all = groupByBatch(filtered);
    const out: Batch[] = [];
    let count = 0;
    for (const b of all) {
      if (count >= shown) break;
      out.push(b);
      count += b.items.length;
    }
    return { batches: out, visibleCount: count };
  }, [grouped, filtered, shown]);
  const flatVisible = grouped ? [] : filtered.slice(0, shown);
  const remaining = filtered.length - visibleCount;

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleBatch = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const latestItems = useMemo(
    () => (latest ? articles.filter((a) => batchOf(a) === latest) : []),
    [articles, latest],
  );

  const journalsTracked = Array.isArray(data?.journals_tracked)
    ? data.journals_tracked.length
    : data?.journals_tracked;

  const chips = filterChips(search, update);
  const meshIndexed = articles.filter((a) => (a.mesh_terms ?? []).length > 0).length;
  const [view, setView] = useListView();

  const isNew = (a: Article) => !grouped && latest !== null && batchOf(a) === latest;
  const renderCard = (a: Article, opts: { heading: 2 | 3 }) => (
    <ArticleCard
      key={articleId(a)}
      article={a}
      query={query}
      listSearch={search}
      showNew={isNew(a)}
      headingLevel={opts.heading}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 pb-6">
        <h1 className="sr-only">Alla artiklar</h1>

        {data && (
          <StatusBar
            journalCount={journalsTracked}
            updated={data.updated}
            latestBatch={latest}
            latestCount={latestItems.length}
            latestTopCount={latestItems.filter((a) => scoreOf(a) >= 4).length}
            nyaActive={Boolean(search.nya)}
            onToggleNya={() => update({ nya: search.nya ? undefined : 1 })}
          />
        )}
        <Toolbar
          className="sm:mt-3"
          search={search}
          update={update}
          resetAll={resetAll}
          queryInput={queryInput}
          setQueryInput={setQueryInput}
          categories={allCategories}
          journals={allJournals}
          resultCount={filtered.length}
          chips={chips.filter((c) => c.key !== "q")}
          latest={latest ? { count: latestItems.length, day: latest } : undefined}
        />

        <div className="flex items-center justify-between gap-x-4 gap-y-1 py-2 sm:py-3">
          <p aria-live="polite" className="min-w-0 text-meta text-muted-foreground">
            {data ? (
              <>
                <strong className="text-foreground">{filtered.length}</strong> av {articles.length}{" "}
                artiklar
                {grouped && filtered.length > 0 && (
                  <span className="hidden sm:inline"> · veckovis, högst AI-relevans först</span>
                )}
              </>
            ) : (
              " "
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <Legend />
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div id="search-help" className="space-y-1">
          {query?.expansions.map((e) => (
            <p key={e.form} className="text-meta text-muted-foreground">
              Söker även {e.also.join(", ")} för {e.form}.
            </p>
          ))}
          {search.mesh && (
            <p className="text-meta text-muted-foreground">
              MeSH-termer finns bara för artiklar som NLM har indexerat ({meshIndexed} av{" "}
              {articles.length}), så nya artiklar saknas oftast här.
            </p>
          )}
        </div>

        <div id="content" tabIndex={-1} className="mt-2 outline-none">
          {isLoading && (
            <div className="space-y-3" aria-label="Laddar artiklar">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-md border bg-card" />
              ))}
            </div>
          )}

          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="rounded-md border border-dashed border-input p-6 sm:p-8">
              {query ? (
                <>
                  <p className="font-medium">Inga träffar för "{search.q}".</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sökningen gäller {SEARCHED_FIELDS}. Alla ord måste finnas med.
                  </p>
                  {query.terms.length > 1 && (
                    <>
                      <p className="mt-3 text-sm text-muted-foreground">Prova utan ett av orden:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {query.terms.map((t) => {
                          const next = withoutTerm(search.q ?? "", t.label);
                          return (
                            <button
                              key={t.label}
                              type="button"
                              onClick={() => {
                                setQueryInput(next);
                                update({ q: next || undefined });
                              }}
                              className="hit-area inline-flex min-h-8 items-center gap-1 rounded-md border border-input bg-card px-3 text-xs hover:bg-muted"
                            >
                              <X aria-hidden className="h-3 w-3" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="font-medium">
                  {chips.length > 0
                    ? "Inga artiklar matchar dina filter."
                    : "Inga artiklar i datakällan ännu."}
                </p>
              )}
              {chips.filter((c) => c.key !== "q").length > 0 && (
                <>
                  <p className="mt-4 text-sm text-muted-foreground">Prova att slå av:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {chips
                      .filter((c) => c.key !== "q")
                      .map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={c.clear}
                          className="hit-area inline-flex min-h-8 items-center gap-1 rounded-md border border-input bg-card px-3 text-xs hover:bg-muted"
                        >
                          <X aria-hidden className="h-3 w-3" />
                          {c.label}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {grouped ? (
            <div className="space-y-10">
              {batches.map((b) => {
                const isCollapsed = collapsed.has(b.key);
                const main = triage ? b.items.filter((a) => scoreOf(a) >= 3) : b.items;
                const low = triage ? b.items.filter((a) => scoreOf(a) < 3) : [];
                const label = b.key
                  ? `${weekLabel(b.key)}, tillagda ${formatDay(b.key)}`
                  : "Okänt datum";
                return (
                  <section key={b.key || "okand"} aria-label={label}>
                    <BatchHeader
                      batch={b}
                      isLatest={b.key === latest}
                      collapsed={isCollapsed}
                      onToggle={() => toggleBatch(b.key)}
                      showTop={!search.min && !search.score}
                    />
                    {!isCollapsed &&
                      (view === "lista" ? (
                        <div className="overflow-hidden rounded-md border border-border bg-card">
                          <RowHeader />
                          <ArticleRows items={main} query={query} listSearch={search} />
                          <LowRelevanceRows
                            variant="inline"
                            items={low}
                            query={query}
                            listSearch={search}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {main.map((a) => renderCard(a, { heading: 3 }))}
                          <LowRelevanceRows items={low} query={query} listSearch={search} />
                        </div>
                      ))}
                  </section>
                );
              })}
            </div>
          ) : view === "lista" ? (
            flatVisible.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <RowHeader />
                <ArticleRows
                  items={flatVisible}
                  query={query}
                  listSearch={search}
                  showNew={isNew}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {flatVisible.map((a) => renderCard(a, { heading: 2 }))}
            </div>
          )}

          {remaining > 0 && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Button variant="outline" onClick={() => update({ n: shown + PAGE_SIZE })}>
                {grouped ? "Visa äldre veckor" : `Visa ${Math.min(PAGE_SIZE, remaining)} till`}
              </Button>
              <p className="text-meta text-muted-foreground">
                Visar {visibleCount} av {filtered.length}
              </p>
            </div>
          )}
        </div>
      </main>

      <DisclaimerFooter />
    </div>
  );
}
