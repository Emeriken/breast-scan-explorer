import { describe, expect, test } from "bun:test";
import { gradeLevel, gradeLines, type Grade } from "../src/lib/grade";
import { deckContent, type DeckInput } from "../src/lib/jc-pptx";

const rct = (domains: Grade["domains"]): Grade => ({ outcome: "PFS", start: "high", domains });
const all = (c: "none" | "na") => ({
  bias: { concern: "none" as const },
  inconsistency: { concern: c },
  indirectness: { concern: "none" as const },
  imprecision: { concern: "none" as const },
  publication: { concern: c },
});

describe("förenklad GRADE", () => {
  test('RCT utan brister är hög; "kan inte bedömas" sänker inte', () => {
    const r = gradeLevel(rct(all("na")));
    expect(r.label).toBe("Hög");
    expect(r.symbols).toBe("⊕⊕⊕⊕");
    expect(r.complete).toBe(true);
  });

  test("nedgraderingar räknas av och nivån stannar vid mycket låg", () => {
    const g = rct({ ...all("na"), bias: { concern: "serious", note: "Öppen design" } });
    expect(gradeLevel(g).label).toBe("Måttlig");
    const worse = rct({
      ...all("na"),
      bias: { concern: "very" },
      imprecision: { concern: "very" },
    });
    expect(gradeLevel(worse).label).toBe("Mycket låg");
    expect(gradeLevel(worse).symbols).toBe("⊕◯◯◯");
  });

  test("uppgradering gäller bara observationsstudier", () => {
    expect(gradeLevel({ ...rct(all("na")), upgrade: 2 }).label).toBe("Hög");
    const obs: Grade = { outcome: "OS", start: "low", domains: all("na"), upgrade: 1 };
    expect(gradeLevel(obs).label).toBe("Måttlig");
  });

  test("ofullständig bedömning kommer inte med i presentationen", () => {
    const article = {
      title: "T",
      journal: "J",
      url: "https://pubmed.ncbi.nlm.nih.gov/1/",
      relevance_score: 5,
      category: "",
      publication_types: ["Randomized Controlled Trial"],
    } as unknown as DeckInput["article"];
    const base: DeckInput = { article, area: "Endokrin behandling", presenter: "", date: "" };
    const text = (v: unknown) => (v as { text: string }[]).map((l) => l.text).join(" | ");
    const partial = deckContent({ ...base, grade: rct({ bias: { concern: "serious" } }) });
    expect(text(partial.S7_TEXT)).not.toContain("GRADE");
    const done = deckContent({
      ...base,
      grade: rct({ ...all("na"), bias: { concern: "serious", note: "Öppen design" } }),
    });
    expect(text(done.S7_TEXT)).toContain("Måttlig ⊕⊕⊕◯ för PFS");
    expect(text(done.S7_TEXT)).toContain(
      "Ett steg ned, risk för systematiska fel (bias): Öppen design",
    );
    expect(text(done.NOTES_7)).toContain("Publikationsbias: Kan inte bedömas");
  });

  test("raderna nämner utfallet och skälen", () => {
    const l = gradeLines(
      rct({ ...all("na"), imprecision: { concern: "serious", note: "KI korsar 1" } }),
    );
    expect(l.summary).toBe("Måttlig ⊕⊕⊕◯ för PFS");
    expect(l.reasons).toEqual(["Ett steg ned, bristande precision: KI korsar 1"]);
  });
});
