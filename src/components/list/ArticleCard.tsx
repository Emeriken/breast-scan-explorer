import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { CategoryTag, PubDateDisplay } from "@/components/ArticleMeta";
import { DeepAnalysisList, hasDeepAnalysis } from "@/components/DeepAnalysis";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { AiTag, NewBadge, NoticeBadge } from "@/components/Labels";
import { MeshTags } from "@/components/MeshTags";
import { RegulatoryBadges } from "@/components/RegulatoryBadges";
import { RUBRIC, ScoreBadge, roundScore } from "@/components/Score";
import { listContext, type ArticleSearch } from "@/lib/article-search";
import { pubmedUrl, type Article } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { authorLine } from "@/lib/regulatory";
import type { ParsedQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Liten extern länk i kortets övre rad, t.ex. "PubMed ↗". */
function SourceLink({
  href,
  title,
  srText,
  className,
  children,
}: {
  href: string;
  title?: string;
  srText?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      title={title}
      {...externalLinkProps}
      className={cn(
        "hit-area inline-flex items-center gap-1 text-meta font-medium underline-offset-2 hover:underline",
        className,
      )}
    >
      {children}
      <ExternalLink aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="sr-only">{srText ? ` ${srText}` : ""} (öppnas i ny flik)</span>
    </a>
  );
}

/**
 * Ett kort i listan. Överst AI-relevans, märken, kategori och källänkar, sedan
 * titel och källa. AI-texten står under en streckad linje: motiveringen
 * alltid, djupanalysen när man fäller ut den. Bara titeln och de uttryckliga
 * länkarna och knapparna är klickbara.
 */
export function ArticleCard({
  article,
  query,
  listSearch,
  showNew,
  headingLevel = 3,
  meshMerge = true,
  actions,
}: {
  article: Article;
  query: ParsedQuery | null;
  /** Listans filter, följer med till artikelsidan för Föregående/Nästa */
  listSearch: ArticleSearch;
  showNew?: boolean;
  headingLevel?: 2 | 3;
  /** MeSH-länkarna läggs till listans filter (annars ersätter de dem) */
  meshMerge?: boolean;
  /** Knappar sist på kortet, t.ex. "Förbered presentation" i Journal club */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const da = article.deep_analysis;
  const deep = hasDeepAnalysis(da);
  const authors = authorLine(article.authors, article.author_count);
  const pmid = article.pmid ?? pmidFromUrl(article.url);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleClass = "text-foreground underline-offset-2 hover:underline";
  // Skalans text, ordagrant, för de artiklar som lyfts fram (4–5)
  const score = roundScore(article.relevance_score);
  const rubric = score >= 4 ? RUBRIC.find((r) => r.score === score)?.text : undefined;

  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card px-4 pb-3.5 pt-4 sm:px-5 sm:pb-4 sm:pt-[18px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ScoreBadge score={article.relevance_score} />
        {showNew && <NewBadge />}
        <NoticeBadge title={article.title} publicationTypes={article.publication_types} />
        <CategoryTag category={article.category} />
        <span className="ml-auto inline-flex items-center gap-3.5">
          <SourceLink
            href={pubmedUrl({ pmid: pmid ?? undefined, url: article.url })}
            className="text-foreground"
          >
            PubMed
          </SourceLink>
          {article.doi && (
            <SourceLink
              href={`https://doi.org/${article.doi}`}
              title={`DOI ${article.doi}`}
              srText={article.doi}
              className="text-ink-2"
            >
              DOI
            </SourceLink>
          )}
        </span>
      </div>

      {rubric && (
        <p className="-mt-0.5 text-meta text-muted-foreground">
          <span className="sr-only">AI-relevans {score}: </span>
          {rubric}
        </p>
      )}

      <Heading className="mt-0.5 text-base font-semibold leading-[22px] tracking-[-0.012em] text-pretty sm:text-lg sm:leading-[26px]">
        {pmid ? (
          <Link
            to="/article/$pmid"
            params={{ pmid }}
            search={listContext(listSearch)}
            className={titleClass}
          >
            <Highlight text={article.title} query={query} />
          </Link>
        ) : (
          <a href={article.url} {...externalLinkProps} className={titleClass}>
            <Highlight text={article.title} query={query} />
            <ExternalLink
              aria-hidden
              className="ml-1 inline h-3.5 w-3.5 align-baseline opacity-60"
            />
          </a>
        )}
      </Heading>

      <p className="text-meta text-muted-foreground">
        <span className="whitespace-nowrap">
          <span className="font-medium text-ink-2">
            <Highlight text={article.journal} query={query} />
          </span>
          <JournalBadge journal={article.journal} />
        </span>
        {article.pub_date && (
          <>
            <span aria-hidden>{"\u00a0· "}</span>
            <PubDateDisplay pubDate={article.pub_date} />
          </>
        )}
        {authors && (
          <>
            <span aria-hidden>{"\u00a0· "}</span>
            <Highlight text={authors} query={query} />
          </>
        )}
      </p>

      <MeshTags terms={article.mesh_terms} variant="card" merge={meshMerge} />

      <RegulatoryBadges reg={article.regulatory} />

      {(article.why_relevant || deep) && (
        <div className="mt-1 flex flex-col gap-1.5 border-t border-dashed border-input pt-3">
          {article.why_relevant && (
            <p className="max-w-[82ch] text-sm leading-[22px] text-ink-2">
              <AiTag className="mr-1.5" />
              <span className="font-semibold text-foreground">Motivering:</span>{" "}
              <Highlight text={article.why_relevant} query={query} />
            </p>
          )}
          {deep && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                className="hit-area inline-flex min-h-7 items-center gap-1 self-start text-meta font-medium text-ink-2 underline-offset-2 hover:text-foreground hover:underline"
              >
                <ChevronDown
                  aria-hidden
                  className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                />
                {open ? "Dölj djupanalys" : "Visa djupanalys"}
              </button>
              {open && <DeepAnalysisList da={da} id={panelId} />}
            </>
          )}
        </div>
      )}

      {actions && <div className="mt-1.5 flex flex-wrap items-center gap-3">{actions}</div>}
    </article>
  );
}
