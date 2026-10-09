import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchFeed } from "../data";

/** Gemener utan diakritiska tecken, så att "strål" matchar "Strålbehandling". */
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

export default defineTool({
  name: "list_articles",
  title: "List articles",
  description:
    "Lista AI-bedömda bröstcancerartiklar. Filtrera på kategori och minsta relevanspoäng (1–5). Sorteras med senast bedömda först.",
  inputSchema: {
    category: z
      .string()
      .optional()
      .describe(
        "Filtrera på behandlingsområde/kategori. Delmatchning som ignorerar versaler och å/ä/ö, t.ex. 'endokrin' eller 'strål'.",
      ),
    min_score: z
      .number()
      .min(1)
      .max(5)
      .optional()
      .describe("Minsta relevanspoäng (1–5)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Max antal artiklar att returnera (standard 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ category, min_score, limit }) => {
    const { articles, updated } = await fetchFeed();
    const cat = category ? normalize(category) : "";
    const filtered = articles.filter((a) => {
      if (cat && !normalize(a.category ?? "").includes(cat)) return false;
      if (min_score != null && (a.relevance_score ?? 0) < min_score) return false;
      return true;
    });
    filtered.sort((a, b) => (b.scored_at ?? "").localeCompare(a.scored_at ?? ""));
    const items = filtered.slice(0, limit ?? 50);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ updated, count: items.length, articles: items }, null, 2),
        },
      ],
      structuredContent: { updated, count: items.length, articles: items },
    };
  },
});