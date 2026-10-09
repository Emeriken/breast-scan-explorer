import { createFileRoute, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JournalBadge } from "@/components/JournalBadge";
import { MeshTags } from "@/components/MeshTags";
import {
  articlesQueryOptions,
  CategoryTag,
  Stars,
  PubDateDisplay,
} from "@/components/ArticleBrowser";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { DisclaimerFooter } from "@/components/Footer";
import { AiTag, NoticeBadge } from "@/components/Labels";
import { DeepAnalysisList, hasDeepAnalysis } from "@/components/DeepAnalysis";

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
  const { data, isLoading, error, refetch } = useQuery(articlesQueryOptions);
  const router = useRouter();
  const canGoBack = useCanGoBack();
  // Gå tillbaka i historiken när det går, så att filter och scrollposition
  // i listan finns kvar. Kom man direkt till artikeln går knappen till startsidan.
  const goBack = () => (canGoBack ? router.history.back() : router.navigate({ to: "/" }));

  const article = data?.articles.find((a) => (a.pmid ?? pmidFromUrl(a.url)) === pmid);
  const authors = article
    ? Array.isArray(article.authors)
      ? article.authors.join(", ")
      : article.authors
    : "";
  const da = article?.deep_analysis;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="max-w-3xl">
          <Button variant="ghost" size="sm" className="-ml-3 mb-4" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Button>
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
                <NoticeBadge title={article.title} />
                <CategoryTag category={article.category} />
                <Stars score={article.relevance_score} />
                <Badge variant="secondary" title="AI-bedömd relevans">
                  AI-relevans {Math.round(article.relevance_score)}/5
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
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <AiTag />
                    Motivering
                  </h2>
                  <p className="mt-1 text-sm">{article.why_relevant}</p>
                </div>
              )}

              {hasDeepAnalysis(da) && (
                <div className="mt-5">
                  <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <AiTag />
                    Djupanalys
                  </h2>
                  <DeepAnalysisList da={da} className="mt-2" />
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
        </div>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
