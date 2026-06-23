import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavTabs } from "@/components/NavTabs";
import { JournalBadge } from "@/components/JournalBadge";
import { MeshTags } from "@/components/MeshTags";
import {
  fetchArticles,
  CategoryTag,
  Stars,
  PubDateDisplay,
} from "@/components/ArticleBrowser";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { DisclaimerFooter } from "@/components/Footer";

export const Route = createFileRoute("/article/$pmid")({
  head: ({ params }) => ({
    meta: [
      { title: `PMID ${params.pmid} — Bröstcancer-bevakning` },
      {
        name: "description",
        content: "Detaljerad vy av en AI-bedömd bröstcancerartikel.",
      },
    ],
  }),
  component: ArticleDetail,
});

function ArticleDetail() {
  const { pmid } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
    staleTime: 60_000,
  });

  const article = data?.articles.find((a) => pmidFromUrl(a.url) === pmid);
  const authors = article
    ? Array.isArray(article.authors)
      ? article.authors.join(", ")
      : article.authors
    : "";
  const da = article?.deep_analysis;
  const hasDeep =
    da &&
    (da.central_finding || da.limitation || da.vs_standard || da.applicability);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-3">
            <NavTabs />
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Tillbaka till listan
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {isLoading && (
          <div className="h-60 animate-pulse rounded-xl border bg-card" />
        )}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            <p>Kunde inte ladda artikel: {(error as Error).message}</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              Försök igen
            </Button>
          </div>
        )}
        {!isLoading && !error && !article && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Artikeln finns inte i vår databas.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Den kan ha publicerats utanför vårt bevakningsfönster (PMID {pmid}).
            </p>
          </div>
        )}
        {article && (
          <article className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CategoryTag category={article.category} />
              <Stars score={article.relevance_score} />
              <Badge variant="secondary">
                Relevans {Math.round(article.relevance_score)}/5
              </Badge>
            </div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              {article.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {article.journal}
              </span>
              <JournalBadge journal={article.journal} />
              <span> · <PubDateDisplay pubDate={article.pub_date} /></span>
            </p>
            {authors && (
              <p className="mt-2 text-xs text-muted-foreground">{authors}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <a href={article.url} {...externalLinkProps}>
                  Öppna i PubMed
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              {article.doi && (
                <Button asChild variant="outline">
                  <a
                    href={`https://doi.org/${article.doi}`}
                    {...externalLinkProps}
                  >
                    DOI: {article.doi}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>

            {article.why_relevant && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Motivering
                </h2>
                <p className="mt-1 text-sm">{article.why_relevant}</p>
              </div>
            )}

            {hasDeep && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Djupanalys
                </h2>
                <dl className="mt-2 grid gap-3 rounded-lg border border-dashed bg-background p-4 text-sm sm:grid-cols-2">
                  {da?.central_finding && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centralt fynd</dt>
                      <dd className="mt-1">{da.central_finding}</dd>
                    </div>
                  )}
                  {da?.limitation && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Begränsning</dt>
                      <dd className="mt-1">{da.limitation}</dd>
                    </div>
                  )}
                  {da?.vs_standard && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jämfört med standard</dt>
                      <dd className="mt-1">{da.vs_standard}</dd>
                    </div>
                  )}
                  {da?.applicability && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tillämpbarhet</dt>
                      <dd className="mt-1">{da.applicability}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {article.mesh_terms && article.mesh_terms.length > 0 && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  MeSH-termer
                </h2>
                <div className="mt-2">
                  <MeshTags terms={article.mesh_terms} />
                </div>
              </div>
            )}
          </article>
        )}
      </main>
      <DisclaimerFooter />
    </div>
  );
}
