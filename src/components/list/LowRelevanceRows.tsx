import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ArticleSearch } from "@/lib/article-search";
import type { Article } from "@/lib/articles";
import type { ParsedQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { ArticleRows } from "./ArticleRow";

/**
 * Artiklar med AI-relevans 1–2, ihopfällda under veckans artiklar. `box` är en
 * egen ruta under korten; `inline` sitter sist i listvyns ruta.
 */
export function LowRelevanceRows({
  items,
  query,
  listSearch,
  variant = "box",
}: {
  items: Article[];
  query: ParsedQuery | null;
  listSearch: ArticleSearch;
  variant?: "box" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (items.length === 0) return null;
  const inline = variant === "inline";
  const content = (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-ink-2 hover:text-foreground",
          inline
            ? "border-t border-border bg-muted px-3 py-3 sm:px-4"
            : "rounded-md px-4 py-3 sm:px-5",
        )}
      >
        <span>
          {open ? "Dölj" : "Visa"} {items.length} med lägre AI-relevans (1–2)
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={listId}>
          <ArticleRows items={items} query={query} listSearch={listSearch} low />
        </div>
      )}
    </>
  );
  if (inline) return content;
  return <div className="rounded-md border border-border bg-card">{content}</div>;
}
