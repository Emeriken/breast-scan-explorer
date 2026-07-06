import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchFeed } from "../data";

export default defineTool({
  name: "search_articles",
  title: "Search articles",
  description:
    "Fritextsök i titel, tidskrift, kategori och AI-motivering bland bröstcancerartiklarna.",
  inputSchema: {
    query: z.string().min(1).describe("Söktext (fritext)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max antal träffar (standard 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }) => {
    const { articles } = await fetchFeed();
    const q = query.toLowerCase();
    const hits = articles.filter((a) =>
      [a.title, a.journal, a.category, a.why_relevant]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
    hits.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    const items = hits.slice(0, limit ?? 25);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ query, count: items.length, articles: items }, null, 2),
        },
      ],
      structuredContent: { query, count: items.length, articles: items },
    };
  },
});