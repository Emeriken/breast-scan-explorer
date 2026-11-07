// Tester för mönstersökningen i artikelns PDF (src/lib/pdf-extract.ts).
// Kör med: bun test tests
// Texterna är påhittade exempel i samma format som tidskrifterna använder.
import { describe, expect, test } from "bun:test";
import {
  analyzePdf,
  effectLabel,
  findCaptions,
  findEffects,
  findNcts,
  findSections,
  lines,
  normalize,
  suggestBox,
  type PdfPage,
  type PdfTextItem,
} from "../src/lib/pdf-extract";

/** En sida där varje rad är en textbit, uppifrån och ned. */
function page(rows: (string | { str: string; x?: number; h?: number })[], n = 1): PdfPage {
  const items: PdfTextItem[] = rows.map((r, i) => {
    const row = typeof r === "string" ? { str: r } : r;
    const h = row.h ?? 9;
    return { str: row.str, x: row.x ?? 50, y: 780 - i * 12, w: row.str.length * 4.5, h, eol: true };
  });
  return { page: n, width: 612, height: 792, items };
}

describe("normalize", () => {
  test("mittpunkt som decimaltecken, tankstreck och AACR:s likhetstecken", () => {
    expect(normalize("HR 0·60 (95% CI 0·45–0·80); P ¼ 0.035")).toBe(
      "HR 0.60 (95% CI 0.45-0.80); P = 0.035",
    );
  });
});

describe("lines", () => {
  test("ord som egna textbitar utan radbrytningar blir rader efter position", () => {
    const words = ["Table", " ", "1", " ", "Baseline", " ", "characteristics"];
    let x = 50;
    const items: PdfTextItem[] = words.map((str) => {
      const it = { str, x, y: 700, w: str.length * 4, h: 9, eol: false };
      x += it.w;
      return it;
    });
    items.push({ str: "Next line", x: 50, y: 688, w: 40, h: 9, eol: false });
    const ls = lines({ page: 1, width: 612, height: 792, items });
    expect(ls.map((l) => l.text)).toEqual(["Table 1 Baseline characteristics", "Next line"]);
  });

  test("stor lucka åt höger (spaltmellanrum) bryter raden", () => {
    const items: PdfTextItem[] = [
      { str: "Left column text", x: 50, y: 700, w: 120, h: 9, eol: false },
      { str: "Right column text", x: 320, y: 700, w: 120, h: 9, eol: false },
    ];
    expect(lines({ page: 1, width: 612, height: 792, items }).length).toBe(2);
  });
});

describe("findEffects", () => {
  test("hittar HR med KI och p-värde i olika format", () => {
    const p = page([
      "The primary endpoint improved (hazard ratio [HR], 0.38; 95% confidence interval [CI],",
      "0.27 to 0.54; P<0.001). Overall survival: HR 0·62 (95% CI 0·38–1·02).",
      "Odds of response were higher (OR = 2.1, 95% CI: 1.4-3.2).",
    ]);
    const effects = findEffects([p]);
    expect(effects.map(effectLabel)).toEqual([
      "HR 0,38 (95 % KI 0,27–0,54); p<0,001",
      "HR 0,62 (95 % KI 0,38–1,02)",
      "OR 2,1 (95 % KI 1,4–3,2)",
    ]);
    expect(effects[0].quote).toContain("primary endpoint");
  });

  test("ordet 'or' räknas inte som oddskvot, och skattning utanför intervallet hoppas över", () => {
    const p = page([
      "The stratified HR for disease progression or death was 0.84 [95% CI, 0.59 to 1.18].",
      "A garbled value HR 3.5 (95% CI 0.2-1.1) is skipped.",
    ]);
    const effects = findEffects([p]);
    expect(effects).toHaveLength(1);
    expect(effects[0].measure).toBe("HR");
    expect(effects[0].est).toBe("0.84");
  });

  test("samma värde med olika decimaler räknas en gång", () => {
    const p = page(["HR 0.80 (95% CI 0.62-1.03) and later HR = 0.8 (95% CI 0.62, 1.03)."]);
    expect(findEffects([p])).toHaveLength(1);
  });
});

describe("findNcts", () => {
  test("nummer vid registreringen kommer först", () => {
    const p = page([
      "Previous trials (NCT01234567) showed benefit.",
      "This trial is registered with ClinicalTrials.gov, NCT07654321.",
    ]);
    expect(findNcts([p]).map((n) => [n.nct, n.registration])).toEqual([
      ["NCT07654321", true],
      ["NCT01234567", false],
    ]);
  });
});

describe("findSections", () => {
  test("finansiering och jäv på sina rubriker", () => {
    const p = page([
      "Funding",
      "This study was supported by a grant from an example foundation and by the sponsor.",
      "Declaration of interests",
      "AB reports consulting fees from Example Pharma. All other authors declare no competing interests.",
    ]);
    const s = findSections([p]);
    expect(s.funding?.text).toStartWith("This study was supported");
    expect(s.coi?.text).toStartWith("AB reports consulting fees");
  });

  test("tacksägelse används för finansiering bara när den nämner stöd", () => {
    const withSupport = page([
      "Acknowledgments",
      "We thank the patients. This work was supported by an example research grant.",
    ]);
    expect(findSections([withSupport]).funding?.heading).toBe("Acknowledgments");
    const without = page([
      "Acknowledgments",
      "We thank the patients and their families for taking part.",
    ]);
    expect(findSections([without]).funding).toBeUndefined();
  });
});

describe("findCaptions", () => {
  test("bildtexter, men inte hänvisningar i löptexten", () => {
    const p = page([
      "Results are shown in Table 2. Patients were enrolled as described.",
      "Fig. 1 | Trial profile.",
      "Table 1. Baseline characteristics of the patients.",
      "(Table 2) shows adverse events.",
      "Supplementary Table 3 lists more.",
      "Figure 7 shows something unrelated.",
    ]);
    const caps = findCaptions([p]);
    expect(caps.map((c) => c.id)).toEqual(["figure1", "table1"]);
    expect(caps[1].text).toBe("Baseline characteristics of the patients.");
  });

  test("ett nummer utan föregångare räknas inte (oftast en hänvisning)", () => {
    const p = page(["Figure 1. First.", "Figure 15. Stray reference with capital."]);
    expect(findCaptions([p]).map((c) => c.num)).toEqual(["1"]);
  });
});

describe("suggestBox", () => {
  test("figurens ruta går från bildtexten upp till närmaste löptext", () => {
    const long = "This is ordinary body text that runs across the full width of the column here.";
    const p = page([
      { str: long, h: 9 },
      { str: long, h: 9 },
      ...Array.from({ length: 10 }, (_, i) => ({ str: `Axis label ${i}`, h: 6 })),
      { str: "Figure 1. Kaplan-Meier estimates of survival.", h: 9 },
      { str: long, h: 9 },
    ]);
    const cap = findCaptions([p])[0];
    const box = suggestBox(p, cap);
    // Rutan ligger mellan bildtextens ovankant och den andra löptextraden
    expect(box.y).toBeGreaterThan(cap.anchor.y);
    expect(box.y + box.h).toBeLessThan(780 - 12 + 1);
  });
});

describe("analyzePdf", () => {
  test("PDF utan textlager markeras", () => {
    const r = analyzePdf([{ page: 1, width: 612, height: 792, items: [] }]);
    expect(r.noText).toBe(true);
    expect(r.effects).toEqual([]);
  });
});
