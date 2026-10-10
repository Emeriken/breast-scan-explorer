import { useEffect, useMemo } from "react";
import {
  createFileRoute,
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTag, PubDateDisplay } from "@/components/ArticleMeta";
import { DeepAnalysisList, hasDeepAnalysis } from "@/components/DeepAnalysis";
import { ErrorState } from "@/components/ErrorState";
import { DisclaimerFooter } from "@/components/Footer";
import { JournalBadge } from "@/components/JournalBadge";
import { AiTag, NoticeBadge } from "@/components/Labels";
import { MeshTags } from "@/components/MeshTags";
import { RegulatorySection } from "@/components/RegulatoryBadges";
import { ScoreBadge } from "@/components/Score";
import { isTypingTarget } from "@/components/ShortcutsProvider";
import { articleSearchSchema, hasActiveFilters, type ArticleSearch } from "@/lib/article-search";
import { listArticles } from "@/lib/article-list";
import {
  articlesQueryOptions,
  pubmedUrl,
  PRODUCT_NAME,
  shortTitle,
  type Article,
} from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { authorLine } from "@/lib/regulatory";

export const Route = createFileRoute("/article/$pmid")({
  // Listans filter följer med i URL:en, så att Föregående och Nästa går i
  // samma ordning som listan man kom ifrån.
  validateSearch: (s) => articleSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: `Artikel · ${PRODUCT_NAME}` },
      {
        name: "description",
        content: "Detaljerad vy av en AI-bedömd bröstcancerartikel.",
      },
    ],
  }),
  component: ArticleDetail,
});

const pmidOf = (a: Article) => a.pmid ?? pmidFromUrl(a.url);

function Pager({
  prev,
  next,
  position,
  total,
  search,
  filtered,
}: {
  prev: Article | null;
  next: Article | null;
  position: number;
  total: number;
  search: ArticleSearch;
  filtered: boolean;
}) {
  const linkClass =
    "hit-area inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground";
  const prevPmid = prev ? pmidOf(prev) : null;
  const nextPmid = next ? pmidOf(next) : null;
  return (
    <nav aria-label="Bläddra i listan" className="flex items-center gap-1">
      {prevPmid ? (
        <Link
          to="/article/$pmid"
          params={{ pmid: prevPmid }}
          search={search}
          replace
          className={linkClass}
          aria-label={`Föregående artikel: ${prev!.title}`}
          title={prev!.title}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          <span className="hidden sm:inline">Föregående</span>
        </Link>
      ) : (
        <span className="inline-flex h-8 w-8 sm:w-auto" />
      )}
      <span className="px-1 text-meta tabular-nums text-muted-foreground">
        {position} av {total}
        <span className="hidden sm:inline">{filtered ? " i din filtrering" : " i listan"}</span>
      </span>
      {nextPmid ? (
        <Link
          to="/article/$pmid"
          params={{ pmid: nextPmid }}
          search={search}
          replace
          className={linkClass}
          aria-label={`Nästa artikel: ${next!.title}`}
          title={next!.title}
        >
          <span className="hidden sm:inline">Nästa</span>
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex h-8 w-8 sm:w-auto" />
      )}
    </nav>
  );
}

function ArticleDetail() {
  const { pmid } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);
  const router = useRouter();
  const canGoBack = useCanGoBack();
  // Gå tillbaka i historiken när det går, så att filter och scrollposition
  // i listan finns kvar. Kom man direkt till artikeln går knappen till listan.
  const goBack = () => (canGoBack ? router.history.back() : router.navigate({ to: "/", search }));

  const article = data?.articles.find((a) => pmidOf(a) === pmid);
  const authors = article ? authorLine(article.authors, article.author_count) : "";
  const da = article?.deep_analysis;

  const list = useMemo(() => (data ? listArticles(data.articles, search) : []), [data, search]);
  const idx = article ? list.findIndex((a) => pmidOf(a) === pmid) : -1;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  // Fliktiteln: artikelns titel i stället för PMID
  useEffect(() => {
    if (article) document.title = `${shortTitle(article.title)} · ${PRODUCT_NAME}`;
  }, [article]);

  // ← och → bläddrar i listan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const el = e.target as HTMLElement | null;
      if (
        el?.closest?.(
          '[role="dialog"],[role="listbox"],[role="menu"],[data-radix-popper-content-wrapper]',
        )
      )
        return;
      const target = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : null;
      const p = target ? pmidOf(target) : null;
      if (!p) return;
      e.preventDefault();
      navigate({ to: "/article/$pmid", params: { pmid: p }, search, replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, navigate, search]);

  return (
    <div className="min-h-screen bg-background">
      <main id="content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 outline-none">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="hit-area -ml-3" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>
            {idx >= 0 && list.length > 1 && (
              <Pager
                prev={prev}
                next={next}
                position={idx + 1}
                total={list.length}
                search={search}
                filtered={hasActiveFilters(search)}
              />
            )}
          </div>

          {isLoading && <div className="h-60 animate-pulse rounded-xl border bg-card" />}

          {error && (
            <ErrorState title="Kunde inte ladda artikeln" error={error} onRetry={() => refetch()} />
          )}

          {!isLoading && !error && !article && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <h1 className="font-medium">Artikeln finns inte i listan.</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                PMID {pmid} kan ha publicerats före bevakningen startade eller i en tidskrift som
                inte bevakas.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {/^\d+$/.test(pmid) && (
                  <Button asChild>
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} {...externalLinkProps}>
                      Öppna PMID {pmid} i PubMed
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/">Till alla artiklar</Link>
                </Button>
              </div>
            </div>
          )}

          {article && (
            <article className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ScoreBadge score={article.relevance_score} />
                <NoticeBadge title={article.title} publicationTypes={article.publication_types} />
                <CategoryTag category={article.category} />
              </div>
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">{article.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">{article.journal}</span>
                <JournalBadge journal={article.journal} />
                <span>
                  {" "}
                  · <PubDateDisplay pubDate={article.pub_date} />
                </span>
              </p>
              {authors && <p className="mt-2 text-meta text-muted-foreground">{authors}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <a href={pubmedUrl(article)} {...externalLinkProps}>
                    Öppna i PubMed
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                {article.doi && (
                  <Button asChild variant="outline" className="max-w-full">
                    <a href={`https://doi.org/${article.doi}`} {...externalLinkProps}>
                      <span className="truncate">DOI: {article.doi}</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>

              {article.why_relevant && (
                <section className="mt-6">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <AiTag />
                    Motivering
                  </h2>
                  <p className="mt-1 text-sm">{article.why_relevant}</p>
                </section>
              )}

              {hasDeepAnalysis(da) && (
                <section className="mt-6">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <AiTag />
                    Djupanalys
                  </h2>
                  <DeepAnalysisList da={da} className="mt-2" />
                </section>
              )}

              <RegulatorySection reg={article.regulatory} className="mt-6" />

              {article.mesh_terms && article.mesh_terms.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    MeSH-termer
                  </h2>
                  <MeshTags terms={article.mesh_terms} className="mt-2" />
                </section>
              )}
            </article>
          )}
        </div>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
