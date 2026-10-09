import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fetchFeed, pmidFromUrl } from "../data";

export default defineTool({
  name: "get_article",
  title: "Get article by PMID",
  description: "Hämta en enskild bröstcancerartikel via dess PubMed-ID (PMID).",
  inputSchema: {
    pmid: z.string().regex(/^\d+$/).describe("PubMed-ID, t.ex. '39012345'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ pmid }) => {
    const { articles } = await fetchFeed();
    const article = articles.find((a) => (a.pmid ?? pmidFromUrl(a.url)) === pmid);
    if (!article) {
      return {
        content: [{ type: "text", text: `Ingen artikel hittad för PMID ${pmid}.` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(article, null, 2) }],
      structuredContent: { article },
    };
  },
});