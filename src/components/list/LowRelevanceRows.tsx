import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { PubDateDisplay } from "@/components/ArticleMeta";
import { Highlight } from "@/components/Highlight";
import { JournalBadge } from "@/components/JournalBadge";
import { NoticeBadge } from "@/components/Labels";
import { ScoreBadge } from "@/components/Score";
import { listContext, type ArticleSearch } from "@/lib/article-search";
import { articleId, type Article } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import type { ParsedQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Artiklar med AI-relevans 1–2, ihopfällda till en rad var under veckans kort. */
export function LowRelevanceRows({
  items,
  query,
  listSearch,
}: {
  items: Article[];
  query: ParsedQuery | null;
  listSearch: ArticleSearch;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        <span>
          {open ? "Dölj" : "Visa"} {items.length} med lägre AI-relevans (1–2)
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {items.map((a) => {
            const pmid = a.pmid ?? pmidFromUrl(a.url);
            return (
              <li key={articleId(a)} className="flex items-start gap-3 px-4 py-2.5">
                <ScoreBadge score={a.relevance_score} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  {pmid ? (
                    <Link
                      to="/article/$pmid"
                      params={{ pmid }}
                      search={listContext(listSearch)}
                      className="text-sm font-medium leading-snug underline-offset-2 hover:underline"
                    >
                      <Highlight text={a.title} query={query} />
                    </Link>
                  ) : (
                    <a
                      href={a.url}
                      {...externalLinkProps}
                      className="text-sm font-medium leading-snug underline-offset-2 hover:underline"
                    >
                      <Highlight text={a.title} query={query} />
                      <ExternalLink aria-hidden className="ml-1 inline h-3.5 w-3.5 opacity-60" />
                    </a>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
                    <NoticeBadge title={a.title} publicationTypes={a.publication_types} />
                    <span>
                      {a.journal}
                      <JournalBadge journal={a.journal} />
                    </span>
                    <span aria-hidden>·</span>
                    <PubDateDisplay pubDate={a.pub_date} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
