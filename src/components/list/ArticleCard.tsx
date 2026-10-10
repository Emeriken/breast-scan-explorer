import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { CategoryTag, PubDateDisplay } from "@/components/ArticleMeta";
import { DeepAnalysisList, hasDeepAnalysis } from "@/components/DeepAnalysis";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { AiTag, NewBadge, NoticeBadge } from "@/components/Labels";
import { MeshTags } from "@/components/MeshTags";
import { RegulatoryBadges } from "@/components/RegulatoryBadges";
import { ScoreBadge } from "@/components/Score";
import { listContext, type ArticleSearch } from "@/lib/article-search";
import { pubmedUrl, type Article } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { authorLine } from "@/lib/regulatory";
import type { ParsedQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * Ett kort i listan. Bara titeln och de uttryckliga länkarna och knapparna
 * är klickbara, så kortet i sig har ingen hover-effekt.
 */
export function ArticleCard({
  article,
  query,
  listSearch,
  density = "full",
  showNew,
  headingLevel = 3,
}: {
  article: Article;
  query: ParsedQuery | null;
  /** Listans filter, följer med till artikelsidan för Föregående/Nästa */
  listSearch: ArticleSearch;
  /** "compact" kortar motiveringen till två rader (AI-relevans 3) */
  density?: "full" | "compact";
  showNew?: boolean;
  headingLevel?: 2 | 3;
}) {
  const [open, setOpen] = useState(false);
  const da = article.deep_analysis;
  const authors = authorLine(article.authors, article.author_count);
  const pmid = article.pmid ?? pmidFromUrl(article.url);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)] sm:p-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={article.relevance_score} />
            {showNew && <NewBadge />}
            <NoticeBadge title={article.title} publicationTypes={article.publication_types} />
            <CategoryTag category={article.category} />
          </div>
          <span className="text-meta text-muted-foreground">
            <PubDateDisplay pubDate={article.pub_date} />
          </span>
        </div>

        <Heading className="text-base font-semibold leading-[1.35] tracking-[-0.01em] sm:text-lg">
          {pmid ? (
            <Link
              to="/article/$pmid"
              params={{ pmid }}
              search={listContext(listSearch)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              <Highlight text={article.title} query={query} />
            </Link>
          ) : (
            <a
              href={article.url}
              {...externalLinkProps}
              className="text-foreground underline-offset-2 hover:underline"
            >
              <Highlight text={article.title} query={query} />
              <ExternalLink
                aria-hidden
                className="ml-1 inline h-3.5 w-3.5 align-baseline opacity-60"
              />
            </a>
          )}
        </Heading>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">
            <Highlight text={article.journal} query={query} />
          </span>
          <JournalBadge journal={article.journal} />
          {authors && (
            <span className="mt-0.5 block line-clamp-1 text-meta">
              <Highlight text={authors} query={query} />
            </span>
          )}
        </div>

        <MeshTags terms={article.mesh_terms} variant="card" merge />

        <RegulatoryBadges reg={article.regulatory} />

        {article.why_relevant && (
          <p
            className={cn(
              "rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-foreground/85",
              density === "compact" && "line-clamp-2",
            )}
          >
            <AiTag className="mr-1.5" />
            <span className="font-semibold text-foreground">Motivering: </span>
            <Highlight text={article.why_relevant} query={query} />
          </p>
        )}

        {hasDeepAnalysis(da) && (
          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="hit-area inline-flex min-h-8 items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground hover:underline"
              aria-expanded={open}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              {open ? "Dölj djupanalys" : "Visa djupanalys"}
            </button>
            {open && <DeepAnalysisList da={da} className="mt-2" />}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
          <a
            href={pubmedUrl({ pmid: pmid ?? undefined, url: article.url })}
            {...externalLinkProps}
            className="hit-area inline-flex items-center gap-1 font-medium text-foreground/85 underline-offset-2 hover:text-foreground hover:underline"
          >
            PubMed
            <ExternalLink aria-hidden className="h-3.5 w-3.5 opacity-60" />
            <span className="sr-only">(öppnas i ny flik)</span>
          </a>
          {article.doi && (
            <a
              href={`https://doi.org/${article.doi}`}
              {...externalLinkProps}
              className="hit-area inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
            >
              <span className="truncate">DOI: {article.doi}</span>
              <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="sr-only">(öppnas i ny flik)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
