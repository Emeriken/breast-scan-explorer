import { createFileRoute } from "@tanstack/react-router";
import { ArticleBrowser } from "@/components/ArticleBrowser";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bröstcancerartiklar – AI-bedömd forskningsöversikt" },
      { name: "description", content: "Bläddra och filtrera AI-bedömda vetenskapliga artiklar om bröstcancer från ledande tidskrifter." },
      { property: "og:title", content: "Bröstcancerartiklar – AI-bedömd forskningsöversikt" },
      { property: "og:description", content: "Bläddra och filtrera AI-bedömda vetenskapliga artiklar om bröstcancer." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ArticleBrowser />;
}
