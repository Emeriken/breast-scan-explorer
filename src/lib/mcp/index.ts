import { defineMcp } from "@lovable.dev/mcp-js";
import listArticles from "./tools/list-articles";
import getArticle from "./tools/get-article";
import searchArticles from "./tools/search-articles";

export default defineMcp({
  name: "brostcancer-bevakning-mcp",
  title: "Bröstcancer-bevakning MCP",
  version: "0.1.0",
  instructions:
    "Verktyg för att söka och läsa AI-bedömda bröstcancerartiklar från Bröstcancer-bevakning. Använd `list_articles` för att bläddra med filter, `search_articles` för fritextsök och `get_article` för att slå upp en specifik artikel via PMID.",
  tools: [listArticles, searchArticles, getArticle],
});