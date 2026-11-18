import { describe, expect, test } from "bun:test";
import { deckContent, type DeckInput } from "../src/lib/jc-pptx";

const article = {
  pmid: "1",
  title: "A randomized trial",
  journal: "Test J",
  pub_date: "2026 Nov",
  url: "https://pubmed.ncbi.nlm.nih.gov/1/",
  relevance_score: 5,
  category: "Endokrin behandling",
  why_relevant: "",
  deep_analysis: null,
  scored_at: "2026-11-18",
  publication_types: ["Randomized Controlled Trial"],
} as unknown as DeckInput["article"];

const base: DeckInput = {
  article,
  area: "Endokrin behandling",
  presenter: "A",
  date: "2026-11-18",
};
const texts = (v: unknown) => (Array.isArray(v) ? v.map((l: { text: string }) => l.text) : [v]);

describe("checklistan i presentationen", () => {
  test("utan checklista står platshållarna kvar", () => {
    const c = deckContent(base);
    expect(texts(c.S8_TEXT)).toEqual(["[Diskussionsfråga 1]", "[Diskussionsfråga 2]"]);
    expect(texts(c.S6_K3).join(" ")).toContain("[Fyll i]");
  });

  test("egen text och valda meningar ersätter platshållarna, med sidnummer", () => {
    const c = deckContent({
      ...base,
      prep: {
        texts: {
          diskussion: "Fråga ett?\nFråga två?",
          begransningar: "Bara en nation",
          fraga: "P: x\nI: y",
        },
        quotes: [
          { kind: "limitations", text: "This study has several limitations.", page: 7 },
          { kind: "aim", text: "Here, we report the trial.", page: 2 },
        ],
      },
    });
    expect(texts(c.S8_TEXT)).toEqual(["Fråga ett?", "Fråga två?"]);
    const lim = texts(c.S6_K3);
    expect(lim).toContain("Enligt författarna:");
    expect(lim).toContain("”This study has several limitations.” (s. 7)");
    expect(lim).toContain("Egna tillägg:");
    expect(lim).toContain("Bara en nation");
    const s2 = texts(c.S2_TEXT);
    expect(s2).toContain("P: x");
    expect(s2).toContain("”Here, we report the trial.” (s. 2)");
    // Bakgrunden saknas: platshållaren står kvar
    expect(s2.join(" ")).toContain("[Fyll i: vad visste vi före studien");
    // Hela meningen i anteckningarna, märkt med var den kommer ifrån
    expect(texts(c.NOTES_6).join(" ")).toContain('Sidan 7: "This study has several limitations."');
  });
});
