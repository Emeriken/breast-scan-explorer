import { useId } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTag, PubDateDisplay } from "@/components/ArticleMeta";
import { DeepAnalysisList, hasDeepAnalysis } from "@/components/DeepAnalysis";
import { JournalBadge } from "@/components/JournalBadge";
import { AiTag, NoticeBadge } from "@/components/Labels";
import { MeshTags } from "@/components/MeshTags";
import { ScoreBadge } from "@/components/Score";
import { pubmedUrl, type Article } from "@/lib/articles";
import { externalLinkProps } from "@/lib/categories";
import { pmidFromUrl } from "@/lib/journals";
import { authorLine } from "@/lib/regulatory";
import { cn } from "@/lib/utils";

/**
 * Delar av artikelsidan som också används i förberedelsevyn i Journal club,
 * så att en artikel ser likadan ut på båda ställena.
 */

const SECTION_HEADING =
  "flex items-center gap-2 text-xs font-semibold uppercase leading-4 tracking-[0.05em] text-muted-foreground";

/** AI-relevans, märken och kategori, titeln och raden med tidskrift, datum och författare. */
export function ArticleHeading({
  article,
  doiInline,
}: {
  article: Article;
  /** Skriv DOI sist på raden, för utskrift där knapparna inte syns */
  doiInline?: boolean;
}) {
  const authors = authorLine(article.authors, article.author_count);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ScoreBadge score={article.relevance_score} />
        <NoticeBadge title={article.title} publicationTypes={article.publication_types} />
        <CategoryTag category={article.category} />
      </div>
      <h1 className="mt-3.5 text-title font-semibold tracking-[-0.02em] text-pretty sm:text-title-lg">
        {article.title}
      </h1>
      <p className="mt-2.5 text-sm leading-5.5 text-muted-foreground">
        <span className="whitespace-nowrap">
          <span className="font-medium text-ink-2">{article.journal}</span>
          <JournalBadge journal={article.journal} />
        </span>
        {article.pub_date && (
          <>
            <span aria-hidden>{" · "}</span>
            <PubDateDisplay pubDate={article.pub_date} />
          </>
        )}
        {authors && (
          <>
            <span aria-hidden>{" · "}</span>
            {authors}
          </>
        )}
        {doiInline && article.doi && (
          <>
            <span aria-hidden>{" · "}</span>
            DOI: {article.doi}
          </>
        )}
      </p>
    </>
  );
}

/** "Öppna i PubMed" och DOI som knappar. */
export function ArticleLinks({ article, className }: { article: Article; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button asChild className="hit-area">
        <a href={pubmedUrl(article)} {...externalLinkProps}>
          Öppna i PubMed
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          <span className="sr-only">(öppnas i ny flik)</span>
        </a>
      </Button>
      {article.doi && (
        <Button asChild variant="outline" className="hit-area max-w-full">
          <a href={`https://doi.org/${article.doi}`} {...externalLinkProps}>
            DOI
            <span className="truncate font-mono text-meta font-normal text-ink-2">
              {article.doi}
            </span>
            <ExternalLink aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">(öppnas i ny flik)</span>
          </a>
        </Button>
      )}
    </div>
  );
}

/**
 * AI-delen: motivering och djupanalys under en streckad linje, var för sig
 * med AI-märkning i rubriken.
 */
export function AiSections({ article, className }: { article: Article; className?: string }) {
  const id = useId();
  const da = article.deep_analysis;
  const deep = hasDeepAnalysis(da);
  if (!article.why_relevant && !deep) return null;
  return (
    <div
      className={cn("mt-7 flex flex-col gap-6 border-t border-dashed border-input pt-6", className)}
    >
      {article.why_relevant && (
        <section aria-labelledby={`${id}-mot`} className="flex flex-col gap-2">
          <h2 id={`${id}-mot`} className={SECTION_HEADING}>
            <AiTag />
            Motivering
          </h2>
          <p className="text-reading text-ink-2">{article.why_relevant}</p>
        </section>
      )}
      {deep && (
        <section aria-labelledby={`${id}-djup`} className="flex flex-col gap-2.5">
          <h2 id={`${id}-djup`} className={SECTION_HEADING}>
            <AiTag />
            Djupanalys
          </h2>
          <DeepAnalysisList da={da} className="sm:px-4.5 sm:py-4" />
        </section>
      )}
    </div>
  );
}

/** Uppgifter ur PubMed-posten: PMID, DOI, datum, publikationstyp och MeSH-termer. */
export function PubMedSection({ article, className }: { article: Article; className?: string }) {
  const id = useId();
  const pmid = article.pmid ?? pmidFromUrl(article.url);
  const types = Array.isArray(article.publication_types)
    ? article.publication_types.filter((t): t is string => typeof t === "string" && t !== "")
    : [];
  const hasMesh = (article.mesh_terms ?? []).length > 0;
  return (
    <section
      aria-labelledby={`${id}-pm`}
      className={cn("mt-7 border-t border-border pt-6", className)}
    >
      <h2 id={`${id}-pm`} className={SECTION_HEADING}>
        Från PubMed
      </h2>
      <dl className="mt-4 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-5.5 sm:grid-cols-[8.75rem_minmax(0,1fr)]">
        {pmid && (
          <>
            <dt className="text-muted-foreground">PMID</dt>
            <dd className="font-mono text-meta text-ink-2">{pmid}</dd>
          </>
        )}
        {article.doi && (
          <>
            <dt className="text-muted-foreground">DOI</dt>
            <dd className="break-all font-mono text-meta text-ink-2">{article.doi}</dd>
          </>
        )}
        {article.pub_date && (
          <>
            <dt className="text-muted-foreground">Publicerad</dt>
            <dd className="text-ink-2">
              <PubDateDisplay pubDate={article.pub_date} />
            </dd>
          </>
        )}
        {types.length > 0 && (
          <>
            <dt className="text-muted-foreground">Publikationstyp</dt>
            <dd lang="en" className="text-ink-2">
              {types.join(" · ")}
            </dd>
          </>
        )}
      </dl>
      {hasMesh && (
        <div className="mt-5 flex flex-col gap-2">
          <h3 className="text-sm font-normal leading-5.5 text-muted-foreground">
            MeSH-termer <span className="text-meta">(huvudämnen enligt NLM först)</span>
          </h3>
          <MeshTags terms={article.mesh_terms} />
        </div>
      )}
    </section>
  );
}
