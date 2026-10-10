import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import { KiJlInfoTooltip } from "@/components/KiJlInfoTooltip";
import { CheckboxList, MultiSelect } from "@/components/MultiSelect";
import { RelevanceInfo } from "@/components/Score";
import { Segmented } from "@/components/Segmented";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DEFAULT_SORT,
  SORT_KEYS,
  SORT_LABELS,
  type ArticleSearch,
  type SortKey,
} from "@/lib/article-search";
import { CATEGORY_DESCRIPTIONS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { FilterChip } from "./filterChips";

type Update = (patch: Partial<ArticleSearch>) => void;

const RELEVANCE_OPTIONS = [
  { value: undefined, label: "Alla" },
  { value: 4 as const, label: "4–5" },
  { value: 5 as const, label: "5" },
];
const PERIOD_OPTIONS = [
  { value: undefined, label: "Alla" },
  { value: "month" as const, label: "Denna månad" },
  { value: "30d" as const, label: "30 dagar" },
];
const LEVEL_OPTIONS = [
  { value: undefined, label: "Alla" },
  { value: 2 as const, label: "L2–L3" },
  { value: 3 as const, label: "L3" },
];

function SortSelect({
  search,
  update,
  fill,
}: {
  search: ArticleSearch;
  update: Update;
  fill?: boolean;
}) {
  return (
    <Select
      value={search.sort ?? DEFAULT_SORT}
      onValueChange={(v) => update({ sort: v === DEFAULT_SORT ? undefined : (v as SortKey) })}
    >
      <SelectTrigger
        className={cn("h-9 gap-2", fill ? "w-full" : "w-auto min-w-[11rem]")}
        aria-label="Sortering"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ArrowUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {SORT_KEYS.map((k) => (
          <SelectItem key={k} value={k}>
            {SORT_LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Tillagd, tidskriftsnivå och tidskrift: används mer sällan, så de ligger bakom en knapp. */
function MoreFilters({
  search,
  update,
  journals,
}: {
  search: ArticleSearch;
  update: Update;
  journals: string[];
}) {
  const count =
    (search.period ? 1 : 0) +
    (search.level || search.lvl ? 1 : 0) +
    (search.journal?.length ? 1 : 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 gap-1.5 font-normal", count > 0 && "border-foreground/40")}
        >
          <SlidersHorizontal aria-hidden className="h-4 w-4" />
          Fler filter
          {count > 0 && (
            <Badge variant="secondary" className="px-1.5">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 p-4"
      >
        <Segmented
          label="Tillagd"
          value={search.period}
          options={PERIOD_OPTIONS}
          onChange={(v) => update({ period: v })}
          fill
        />
        <Segmented
          label="Tidskriftsnivå (KI-JL)"
          info={<KiJlInfoTooltip />}
          value={search.lvl ? "__none__" : search.level}
          options={LEVEL_OPTIONS}
          onChange={(v) => update({ level: v, lvl: undefined })}
          fill
        />
        <div>
          <span className="flex h-6 items-center text-xs font-medium text-muted-foreground">
            Tidskrift
          </span>
          <CheckboxList
            className="max-h-56 overflow-y-auto rounded-md border p-1"
            options={journals}
            selected={search.journal ?? []}
            onChange={(v) => update({ journal: v.length ? v : undefined })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Alla filter i ett bottenark, för mobil. */
function FilterSheet({
  search,
  update,
  resetAll,
  categories,
  journals,
  resultCount,
  activeCount,
}: {
  search: ArticleSearch;
  update: Update;
  resetAll: () => void;
  categories: string[];
  journals: string[];
  resultCount: number;
  activeCount: number;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 shrink-0 gap-1.5 sm:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter och sortering</SheetTitle>
          <SheetDescription className="sr-only">
            Listan uppdateras direkt när du ändrar ett val.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">
          <Segmented
            label="AI-relevans"
            info={<RelevanceInfo />}
            value={search.score ? "__none__" : search.min}
            options={RELEVANCE_OPTIONS}
            onChange={(v) => update({ min: v, score: undefined })}
            fill
          />
          <Segmented
            label="Tillagd"
            value={search.period}
            options={PERIOD_OPTIONS}
            onChange={(v) => update({ period: v })}
            fill
          />
          <Segmented
            label="Tidskriftsnivå (KI-JL)"
            info={<KiJlInfoTooltip />}
            value={search.lvl ? "__none__" : search.level}
            options={LEVEL_OPTIONS}
            onChange={(v) => update({ level: v, lvl: undefined })}
            fill
          />
          <MultiSelect
            label="Kategori"
            options={categories}
            selected={search.cat ?? []}
            onChange={(v) => update({ cat: v.length ? v : undefined })}
            descriptions={CATEGORY_DESCRIPTIONS}
            fill
          />
          <MultiSelect
            label="Tidskrift"
            options={journals}
            selected={search.journal ?? []}
            onChange={(v) => update({ journal: v.length ? v : undefined })}
            fill
          />
          <div className="flex flex-col gap-1">
            <span className="flex h-6 items-center text-xs font-medium text-muted-foreground">
              Sortering
            </span>
            <SortSelect search={search} update={update} fill />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {activeCount > 0 && (
            <Button variant="outline" className="h-11 flex-1" onClick={resetAll}>
              Rensa filter
            </Button>
          )}
          <SheetClose asChild>
            <Button className="h-11 flex-1">
              Visa {resultCount} {resultCount === 1 ? "artikel" : "artiklar"}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Sökfält och filter. Följer med när man skrollar, på dator och mobil, och
 * visar varje aktivt filter som ett chip som går att ta bort.
 */
export function Toolbar({
  search,
  update,
  resetAll,
  queryInput,
  setQueryInput,
  categories,
  journals,
  resultCount,
  chips,
  className,
}: {
  search: ArticleSearch;
  update: Update;
  resetAll: () => void;
  queryInput: string;
  setQueryInput: (s: string) => void;
  categories: string[];
  journals: string[];
  resultCount: number;
  chips: FilterChip[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 print:static",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="article-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Sök titel, författare, läkemedel, MeSH, PMID"
            aria-label="Sök bland artiklarna"
            aria-describedby="search-help"
            className="h-11 rounded-md border-border pl-9 pr-11 shadow-inner focus-visible:border-foreground/40 sm:h-9"
          />
          {queryInput ? (
            <button
              type="button"
              aria-label="Töm sökfältet"
              onClick={() => {
                setQueryInput("");
                update({ q: undefined });
                document.getElementById("article-search")?.focus();
              }}
              className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:h-7 sm:w-7"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd
              aria-hidden
              title="Tryck / för att söka"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground sm:block"
            >
              /
            </kbd>
          )}
        </div>

        <FilterSheet
          search={search}
          update={update}
          resetAll={resetAll}
          categories={categories}
          journals={journals}
          resultCount={resultCount}
          activeCount={chips.filter((c) => c.key !== "q").length}
        />

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Segmented
            inline
            label="AI-relevans"
            info={<RelevanceInfo />}
            value={search.score ? "__none__" : search.min}
            options={RELEVANCE_OPTIONS}
            onChange={(v) => update({ min: v, score: undefined })}
          />
          <MultiSelect
            inline
            label="Kategori"
            options={categories}
            selected={search.cat ?? []}
            onChange={(v) => update({ cat: v.length ? v : undefined })}
            descriptions={CATEGORY_DESCRIPTIONS}
          />
          <MoreFilters search={search} update={update} journals={journals} />
          <SortSelect search={search} update={update} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Aktiva filter">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              aria-label={`Ta bort filtret ${c.label}`}
              className="hit-area inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs hover:bg-muted"
            >
              <span className="truncate">{c.label}</span>
              <X aria-hidden className="h-3 w-3 shrink-0" />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={resetAll}
              className="hit-area text-xs font-medium text-foreground underline-offset-2 hover:underline"
            >
              Rensa alla
            </button>
          )}
        </div>
      )}
    </div>
  );
}
