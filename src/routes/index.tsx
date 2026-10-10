import { createFileRoute } from "@tanstack/react-router";
import { ArticleBrowser } from "@/components/ArticleBrowser";
import { articleSearchSchema } from "@/lib/article-search";
import { PRODUCT_NAME } from "@/lib/articles";

export const Route = createFileRoute("/")({
  validateSearch: (s) => articleSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: `Alla artiklar · ${PRODUCT_NAME}` },
      {
        name: "description",
        content:
          "Bläddra och filtrera AI-bedömda vetenskapliga artiklar om bröstcancer från ledande tidskrifter.",
      },
      { property: "og:title", content: PRODUCT_NAME },
      {
        property: "og:description",
        content: "Bläddra och filtrera AI-bedömda vetenskapliga artiklar om bröstcancer.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <ArticleBrowser />;
}
