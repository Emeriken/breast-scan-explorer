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

  test("två figurer bredvid varandra får var sin spalt", () => {
    // Som Breast Cancer Research: en figur i vänster spalt, en i höger,
    // bildtexterna i olika höjd och löptext under båda.
    const body = "This is ordinary body text that runs across the full width of a column.";
    const items: PdfTextItem[] = [];
    const add = (str: string, x: number, y: number, h = 9) =>
      items.push({ str, x, y, w: Math.min(str.length * 3.3, 240), h, eol: true });
    for (let i = 0; i < 20; i++) {
      add(`Axis ${i}`, 60, 740 - i * 14, 6);
      add(`Axis ${i}`, 310, 740 - i * 14, 6);
    }
    add("Fig. 2 Cumulative incidence of time to first ALT elevation", 305, 418);
    add("Fig. 1 Cumulative incidence of time to first neutropenia", 57, 438);
    for (let i = 0; i < 8; i++) {
      add(body, 57, 400 - i * 12);
      add(body, 305, 380 - i * 12);
    }
    const p: PdfPage = { page: 1, width: 595, height: 794, items };
    const caps = findCaptions([p]);
    const [left, right] = ["figure1", "figure2"].map((id) => caps.find((c) => c.id === id)!);
    const bl = suggestBox(p, left);
    const br = suggestBox(p, right);
    expect(bl.x + bl.w).toBeLessThan(300);
    expect(br.x).toBeGreaterThan(295);
  });
});

describe("findCaptions, avstavning", () => {
  test("avstavning vid radbrytning tas bort i bildtexten", () => {
    const p = page(["Fig. 1 Cumulative incidence of AE-related ri-", "bociclib discontinuation"]);
    expect(findCaptions([p])[0].text).toContain("ribociclib discontinuation");
  });
});

describe("analyzePdf", () => {
  test("PDF utan textlager markeras", () => {
    const r = analyzePdf([{ page: 1, width: 612, height: 792, items: [] }]);
    expect(r.noText).toBe(true);
    expect(r.effects).toEqual([]);
  });
});

// --- NEJM-format ------------------------------------------------------------------

/** Rader med egen position: [text, x, y, höjd]. */
function placed(rows: [string, number, number, number?][], n = 1): PdfPage {
  return {
    page: n,
    width: 612,
    height: 792,
    items: rows.map(([str, x, y, h = 9]) => ({
      str,
      x,
      y,
      w: Math.min(str.length * 4.2, 260),
      h,
      eol: true,
    })),
  };
}

describe("NEJM", () => {
  test("avstavning: bindestreck i sammansättningar står kvar", () => {
    expect(normalize("investigator-assessed progression-\nfree survival")).toBe(
      "investigator-assessed progression-free survival",
    );
    expect(normalize("252 pa-\ntients")).toBe("252 patients");
  });

  test("citatet börjar inte mitt i ett ord och slutar inte vid (Fig.", () => {
    const filler = "word ".repeat(140);
    const p = page([
      `${filler}hazard ratio for progression or death, 0.46; 95% CI, 0.37 to 0.56) (Fig. S2). Next sentence.`,
    ]);
    const [e] = findEffects([p]);
    expect(e.quote.startsWith("… word")).toBe(true);
    expect(e.quote.endsWith("(Fig. S2).")).toBe(true);
  });

  test("Supported by och formulär för jäv", () => {
    const p = page([
      "Supported by Shanghai JMT-Bio Technology, with partial support from the National Natural Science Foundation of China.",
      "Disclosure forms provided by the authors are available with the full text of this article at NEJM.org.",
    ]);
    const s = findSections([p]);
    expect(s.funding?.text.startsWith("Supported by Shanghai JMT-Bio Technology")).toBe(true);
    expect(s.coi?.text).toContain("Disclosure forms provided by the authors");
  });

  test("finansiär inom parentes i abstractet när avsnitt saknas", () => {
    const p = page([
      "THP among patients with HER2-positive advanced breast cancer. (Funded by Shanghai",
      "JMT-Bio Technology; ClinicalTrials.gov number, NCT05838066.)",
    ]);
    expect(findSections([p]).funding?.text).toBe("Funded by Shanghai JMT-Bio Technology.");
  });

  test("Figure 2 (facing page): figuren hämtas från uppslagets andra sida", () => {
    const fig1 = placed([["Figure 1. Screening, Randomization, and Follow-up.", 40, 100]], 5);
    const figPage = placed(
      [
        ["A Progression-free Survival", 40, 740],
        ["Months since Randomization", 200, 400, 7],
        ["6", 40, 40],
      ],
      6,
    );
    const capPage = placed(
      [
        [
          "Figure 2 (facing page). Progression-free Survival, Overall and According to Subgroup.",
          40,
          700,
        ],
      ],
      7,
    );
    const cap = findCaptions([fig1, figPage, capPage]).find((c) => c.id === "figure2")!;
    expect(cap.page).toBe(6);
    expect(cap.text.startsWith("Progression-free Survival")).toBe(true);
    const box = suggestBox(figPage, cap);
    // Hela sidan ovanför sidfoten
    expect(box.y).toBeGreaterThan(40);
    expect(box.y + box.h).toBeGreaterThan(740);
  });

  test("tabellens bildtext slutar vid .* och rutan slutar före löptexten", () => {
    const body = "The current phase 3 trial evaluated a HER2-tar geted bispecific antibody plus";
    const rows: [string, number, number, number?][] = [
      ["Table 1. Summary of Efficacy as Assessed by Investigators.* Variable Anbenitamab", 40, 700],
      ["Complete response", 40, 660, 8],
      ["17 (3.8)", 300, 660, 8],
      ["Partial response", 40, 640, 8],
      ["373 (83.8)", 300, 640, 8],
      ["* Efficacy analyses were performed in the intention-to-treat population.", 40, 600, 7],
    ];
    for (let i = 0; i < 6; i++) {
      rows.push([body, 40, 520 - i * 12]);
      rows.push([body, 320, 520 - i * 12]);
    }
    const p = placed(rows, 8);
    const [cap] = findCaptions([p]);
    expect(cap.text).toBe("Summary of Efficacy as Assessed by Investigators.*");
    const box = suggestBox(p, cap);
    expect(box.y).toBeGreaterThan(520);
    expect(box.y).toBeLessThan(600);
  });
});

// --- Lancet-format ----------------------------------------------------------------

/** Rader med position och typsnitt: [text, x, y, höjd, typsnitt]. */
function fonted(rows: [string, number, number, number, string][], n = 1): PdfPage {
  return {
    page: n,
    width: 595,
    height: 799,
    items: rows.map(([str, x, y, h, font]) => ({
      str,
      x,
      y,
      w: Math.min(str.length * 0.45 * h, 300),
      h,
      eol: true,
      font,
    })),
  };
}

describe("Lancet", () => {
  test("KI-nivån följer med: 90 % KI står inte som 95 %", () => {
    const p = page(["The 5-year HR was 1·13 (90% CI 0·77–1·66) for locoregional recurrence."]);
    const [e] = findEffects([p]);
    expect(e.ci).toBe("90");
    expect(effectLabel(e)).toBe("HR 1,13 (90 % KI 0,77–1,66)");
  });

  test("träff i figurtext citerar bara raden, och löptexten går före figuren", () => {
    const rows: [string, number, number, number, string][] = [];
    for (let i = 0; i < 6; i++)
      rows.push([
        "Ordinary body text that runs across the full column width here.",
        30,
        700 - i * 12,
        9,
        "R",
      ]);
    rows.push(["409 (0) 383 (16) 349 (29) 318 (36) 288 (37)", 260, 500, 6, "R"]);
    rows.push(["HR 1·37, 95% CI 0·57–3·25", 400, 488, 6, "R"]);
    rows.push(["Number at risk (events) Conventional fractionated", 260, 476, 6, "R"]);
    const fig = fonted(rows, 5);
    const body = page(
      ["Local recurrence was similar (subdistribution HR 1·37, 95% CI 0·57–3·25; figure 1B)."],
      7,
    );
    const onlyFig = findEffects([fig]);
    expect(onlyFig[0].quote).toBe("HR 1.37, 95% CI 0.57-3.25");
    const both = findEffects([fig, body]);
    expect(both).toHaveLength(1);
    expect(both[0].page).toBe(7);
  });

  test("referensnummer efter punkten hör till meningen före", () => {
    const p = page([
      "Risk factors should also be considered. 18,19 The similar incidences were consistent",
      "with a meta-analysis (HR 1·00, 95% CI 0·78–1·29; p=0·98).",
    ]);
    expect(findEffects([p])[0].quote.startsWith("The similar incidences")).toBe(true);
  });

  test("fet rubrik: bildtexten slutar före beskrivningen i brödstil", () => {
    const p = fonted([
      [
        "Figure 1: Cumulative incidence of recurrence by region and treatment group",
        262,
        137,
        7,
        "Bold",
      ],
      [
        "(A) Locoregional recurrence. (B) Local recurrence. (C) Regional recurrence.",
        262,
        128,
        7,
        "Reg",
      ],
    ]);
    expect(findCaptions([p])[0].text).toBe(
      "Cumulative incidence of recurrence by region and treatment group",
    );
  });

  test("figur till höger om en smal spalt får bildtextens bredd, utan sidhuvud", () => {
    const rows: [string, number, number, number, string][] = [["Articles", 508, 752, 12, "H"]];
    // Smal löptextspalt till vänster hela vägen
    for (let i = 0; i < 50; i++)
      rows.push(["Ordinary body text in the narrow left column.", 30, 700 - i * 11, 9, "R"]);
    // Figurens texter till höger
    for (let i = 0; i < 8; i++)
      rows.push([`Axis label ${i}`, 270 + (i % 2) * 200, 650 - i * 50, 6, "R"]);
    rows.push(["Figure 1: Cumulative incidence of recurrence by region", 262, 137, 7, "Bold"]);
    rows.push(["(A) Locoregional recurrence. (B) Local recurrence.", 262, 128, 7, "Reg"]);
    const p = fonted(rows, 5);
    const [cap] = findCaptions([p]);
    const box = suggestBox(p, cap);
    expect(box.x).toBeGreaterThan(255);
    expect(box.y + box.h).toBeLessThan(700); // inte upp till sidhuvudet
    expect(box.y + box.h).toBeGreaterThan(650);
  });

  test("tabell med bildtexten under: rutan ligger ovanför bildtexten", () => {
    const rows: [string, number, number, number, string][] = [];
    for (let i = 0; i < 12; i++) rows.push([`Chest wall row ${i}`, 34, 220 - i * 12, 7, "R"]);
    rows.push(["Table 1: Sites of locoregional recurrence by treatment group", 34, 54, 7, "Bold"]);
    const p = fonted(rows, 4);
    const [cap] = findCaptions([p]);
    const box = suggestBox(p, cap);
    expect(box.y).toBeGreaterThanOrEqual(54);
    expect(box.y + box.h).toBeGreaterThan(220);
  });
});
