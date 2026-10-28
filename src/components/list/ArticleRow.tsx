import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { PubDateDisplay } from "@/components/ArticleMeta";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { NewBadge, NoticeBadge } from "@/components/Labels";
import { ScoreBadge } from "@/components/Score";
import { listContext, type ArticleSearch } from "@/lib/article-search";
import { articleId, pubmedUrl, type Article } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import type { ParsedQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Kolumnerna i listvyn: AI-relevans, artikel och (från sm) källa. */
export const ROW_GRID =
  "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-3 sm:grid-cols-[5rem_minmax(0,1fr)_4.5rem] sm:gap-x-4 sm:px-4";

/** Kolumnrubriker ovanför raderna. Bara visuellt: varje rad är begriplig på egen hand. */
export function RowHeader() {
  return (
    <div
      aria-hidden
      className={cn(
        ROW_GRID,
        "whitespace-nowrap bg-muted py-2 text-xs font-semibold leading-4 text-muted-foreground",
      )}
    >
      <span>AI-relevans</span>
      <span>Artikel</span>
      <span className="hidden text-right sm:block">Källa</span>
    </div>
  );
}

/**
 * En artikel som en rad: AI-relevans, titel, kategori, tidskrift och datum.
 * `low` ger en mindre titel, för ihopfällda artiklar med AI-relevans 1–2.
 */
export function ArticleRow({
  article: a,
  query,
  listSearch,
  showNew,
  low,
}: {
  article: Article;
  query: ParsedQuery | null;
  listSearch: ArticleSearch;
  showNew?: boolean;
  low?: boolean;
}) {
  const pmid = a.pmid ?? pmidFromUrl(a.url);
  const titleClass = cn(
    "text-foreground underline-offset-2 hover:underline",
    low ? "text-sm font-medium leading-5" : "text-reading font-semibold leading-5.5",
  );
  return (
    <li className={cn(ROW_GRID, "items-start border-t border-border", low ? "py-2.5" : "py-3")}>
      <ScoreBadge score={a.relevance_score} size="sm" className="justify-self-start" />
      <div className="min-w-0">
        {pmid ? (
          <Link
            to="/article/$pmid"
            params={{ pmid }}
            search={listContext(listSearch)}
            className={titleClass}
          >
            <Highlight text={a.title} query={query} />
          </Link>
        ) : (
          <a href={a.url} {...externalLinkProps} className={titleClass}>
            <Highlight text={a.title} query={query} />
            <ExternalLink aria-hidden className="ml-1 inline h-3.5 w-3.5 opacity-60" />
          </a>
        )}
        <p className="mt-0.5 text-meta text-muted-foreground">
          {showNew && <NewBadge className="mr-1.5 align-[1px]" />}
          <NoticeBadge
            title={a.title}
            publicationTypes={a.publication_types}
            className="mr-1.5 align-[1px]"
          />
          <span>{a.category}</span>
          <span aria-hidden>{"\u00a0· "}</span>
          <span className="whitespace-nowrap">
            <span className="font-medium text-ink-2">
              <Highlight text={a.journal} query={query} />
            </span>
            <JournalBadge journal={a.journal} />
          </span>
          {a.pub_date && (
            <>
              <span aria-hidden>{"\u00a0· "}</span>
              <PubDateDisplay pubDate={a.pub_date} />
            </>
          )}
        </p>
      </div>
      <a
        href={pubmedUrl({ pmid: pmid ?? undefined, url: a.url })}
        {...externalLinkProps}
        className={cn(
          "hit-area hidden items-center gap-1 justify-self-end text-meta font-medium text-foreground underline-offset-2 hover:underline sm:inline-flex",
          low ? "leading-5" : "leading-5.5",
        )}
      >
        PubMed
        <ExternalLink aria-hidden className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="sr-only">(öppnas i ny flik)</span>
      </a>
    </li>
  );
}

/** Rader i en `<ol>`. Varje rad har egen linje upptill. */
export function ArticleRows({
  items,
  query,
  listSearch,
  showNew,
  low,
}: {
  items: Article[];
  query: ParsedQuery | null;
  listSearch: ArticleSearch;
  showNew?: (a: Article) => boolean;
  low?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ol>
      {items.map((a) => (
        <ArticleRow
          key={articleId(a)}
          article={a}
          query={query}
          listSearch={listSearch}
          showNew={showNew?.(a)}
          low={low}
        />
      ))}
    </ol>
  );
}
