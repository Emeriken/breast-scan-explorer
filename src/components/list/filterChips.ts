import type { ArticleSearch } from "@/lib/article-search";

export type FilterChip = { key: string; label: string; clear: () => void };

/** Ett chip per aktivt filter, i samma ordning som kontrollerna. */
export function filterChips(
  search: ArticleSearch,
  update: (patch: Partial<ArticleSearch>) => void,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (search.q)
    chips.push({ key: "q", label: `Sök: "${search.q}"`, clear: () => update({ q: undefined }) });
  if (search.nya)
    chips.push({
      key: "nya",
      label: "Senaste uppdateringen",
      clear: () => update({ nya: undefined }),
    });
  if (search.min)
    chips.push({
      key: "min",
      label: search.min === 5 ? "AI-relevans 5" : "AI-relevans 4–5",
      clear: () => update({ min: undefined }),
    });
  if (search.score)
    chips.push({
      key: "score",
      label: `AI-relevans ${search.score}`,
      clear: () => update({ score: undefined }),
    });
  for (const c of search.cat ?? [])
    chips.push({
      key: `cat:${c}`,
      label: `Kategori: ${c}`,
      clear: () => {
        const rest = (search.cat ?? []).filter((x) => x !== c);
        update({ cat: rest.length ? rest : undefined });
      },
    });
  if (search.mesh)
    chips.push({
      key: "mesh",
      label: `MeSH: ${search.mesh}`,
      clear: () => update({ mesh: undefined }),
    });
  if (search.period)
    chips.push({
      key: "period",
      label: search.period === "month" ? "Tillagd denna månad" : "Tillagd senaste 30 dagarna",
      clear: () => update({ period: undefined }),
    });
  if (search.level)
    chips.push({
      key: "level",
      label: search.level === 3 ? "KI-JL L3" : "KI-JL L2–L3",
      clear: () => update({ level: undefined }),
    });
  if (search.lvl)
    chips.push({
      key: "lvl",
      label: `KI-JL L${search.lvl}`,
      clear: () => update({ lvl: undefined }),
    });
  for (const j of search.journal ?? [])
    chips.push({
      key: `journal:${j}`,
      label: `Tidskrift: ${j}`,
      clear: () => {
        const rest = (search.journal ?? []).filter((x) => x !== j);
        update({ journal: rest.length ? rest : undefined });
      },
    });
  return chips;
}
