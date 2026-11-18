// Tester för mönstersökningen i artikelns PDF (src/lib/pdf-extract.ts).
// Kör med: bun test tests
// Texterna är påhittade exempel i samma format som tidskrifterna använder.
import { describe, expect, test } from "bun:test";
import {
  analyzePdf,
  cutRows,
  effectLabel,
  findCaptions,
  findEffects,
  findNcts,
  findCuts,
  findPassages,
  findSections,
  lines,
  pixelRows,
  planSplit,
  tableHeader,
  textSize,
  normalize,
  suggestBox,
  type PdfPage,
  type PdfTextItem,
} from "../src/lib/pdf-extract";
import { inkProfile } from "../src/lib/pdf-read";

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

// --- JAMA-format ------------------------------------------------------------------

describe("JAMA", () => {
  test("Funding/Support och Conflict of Interest Disclosures", () => {
    const p = page([
      "Conflict of Interest Disclosures: Dr Xu reported personal fees from AstraZeneca and Novartis outside the submitted work.",
      "Funding/Support: This study was supported by Avanc Pharmaceutical Co Ltd, with partial support from national funding.",
    ]);
    const s = findSections([p]);
    expect(s.funding?.heading).toBe("Funding/Support");
    expect(s.funding?.text.startsWith("This study was supported by Avanc")).toBe(true);
    expect(s.coi?.heading).toBe("Conflict of Interest Disclosures");
  });

  test("bildtexten överst: figuren står under, utan text i ytterkanten", () => {
    const rows: [string, number, number, number, string][] = [
      ["Fovinaciclib for First-Line Therapy of Advanced Breast Cancer", 72, 754, 7, "R"],
      ["Figure 1. Patient Disposition", 72, 716, 7, "B"],
    ];
    for (let i = 0; i < 12; i++)
      rows.push([`Box ${i}: patients assessed`, 90 + (i % 3) * 150, 690 - i * 22, 7, "R"]);
    for (let i = 0; i < 10; i++) {
      rows.push([
        "Ordinary body text that runs across the full column width.",
        72,
        380 - i * 12,
        9,
        "R",
      ]);
      rows.push([
        "Ordinary body text that runs across the full column width.",
        312,
        380 - i * 12,
        9,
        "R",
      ]);
    }
    // "Downloaded from …" längs vänsterkanten och upphovsrätt längst ned
    rows.push(["Downloaded from jamanetwork.com by Karolinska Institutet", 3, 10, 8, "R"]);
    const p = fonted(rows, 3);
    const [cap] = findCaptions([p]);
    const box = suggestBox(p, cap);
    expect(box.x).toBeGreaterThan(60);
    expect(box.y).toBeGreaterThan(380);
    expect(box.y + box.h).toBeLessThanOrEqual(716 + 7 + 3); // bildtextraden som mest
    expect(box.y + box.h).toBeGreaterThan(690);
  });

  test("lång bildtext kortas vid ett helt ord", () => {
    const long =
      "Figure 1 Kaplan-Meier Curves of Progression-Free Survival in the Intent-to-Treat Population According to Assessment by Blinded Independent Central Review and by Investigators in All Patients Who Were Randomized";
    const [cap] = findCaptions([page([long])]);
    expect(cap.text.endsWith(" …")).toBe(true);
    expect(cap.text.length).toBeLessThanOrEqual(184);
    expect(/\s\S+ …$/.test(cap.text)).toBe(true);
  });
});

// --- JCO-format -------------------------------------------------------------------

describe("JCO", () => {
  test('"P 5 .004" är P = .004 och absolut skillnad med KI hittas', () => {
    const p = page([
      "corresponding to an estimated difference of -2.1% (95% CI, -6.5 to 2.2; P 5 .001).",
      "regardless of treatment arm (odds ratio [OR], 2.96 [95% CI, 1.4 to 6.2]; P 5 .004).",
    ]);
    const [d, or] = findEffects([p]);
    expect(d.measure).toBe("Skillnad");
    expect(effectLabel(d)).toBe("Skillnad −2,1 % (95 % KI −6,5 till 2,2); p = ,001");
    expect(effectLabel(or)).toBe("OR 2,96 (95 % KI 1,4–6,2); p = ,004");
  });

  test("SUPPORT och versalrubrik för jäv, avslutad vid nästa versalrubrik", () => {
    const p = page([
      "SUPPORT",
      "Supported in whole or in part by the National Cancer Institute of the National Institutes of Health.",
      "AUTHORS’ DISCLOSURES OF POTENTIAL CONFLICTS",
      "OF INTEREST",
      "Disclosures provided by the authors are available with this article at DOI https://doi.org/10.1200/JCO-26-00474.",
      "DATA SHARING STATEMENT",
      "A data sharing statement provided by the authors is available with this article.",
    ]);
    const s = findSections([p]);
    expect(
      s.funding?.text.startsWith("Supported in whole or in part by the National Cancer Institute"),
    ).toBe(true);
    expect(s.coi?.heading).toBe("AUTHORS’ DISCLOSURES OF POTENTIAL CONFLICTS OF INTEREST");
    expect(s.coi?.text).not.toContain("DATA SHARING");
  });

  test("ensam axeltitel i figuren stoppar inte rutan", () => {
    const rows: [string, number, number, number, string][] = [];
    for (let i = 0; i < 10; i++)
      rows.push([
        "Body text that runs across the full column width here and more.",
        37,
        760 - i * 12,
        8.5,
        "R",
      ]);
    for (let i = 0; i < 8; i++) rows.push([`${i}%`, 160 + i * 40, 600 - i * 30, 6, "R"]);
    rows.push(["Conventional PMRT – Hypofractionated PMRT axis", 169, 269, 9, "R"]);
    rows.push([
      "FIG 1. (A) Forest plot, intention-to-treat. (B) Forest plot, as reconstructed.",
      47,
      239,
      8,
      "B",
    ]);
    const p = fonted(rows, 7);
    const [cap] = findCaptions([p]);
    expect(cap.text).toContain("(B) Forest plot");
    const box = suggestBox(p, cap);
    expect(box.y + box.h).toBeGreaterThan(600);
  });
});

// --- Läsbarhet och uppdelning --------------------------------------------------

describe("läsbarhet", () => {
  const AREA = { w: 9, h: 3.77 };

  test("en hel tabellsida delas i tre bilder för läsbar text", () => {
    // NEJM Tabell 1: 379 × 556 pt med 8 pt text
    const plan = planSplit({ x: 0, y: 0, w: 379, h: 556 }, 8, AREA);
    expect(plan.ptWhole).toBeLessThan(5);
    expect(plan.parts).toBe(3);
    expect(plan.pt).toBeGreaterThanOrEqual(9);
  });

  test("en låg tabell står kvar på en bild", () => {
    expect(planSplit({ x: 0, y: 0, w: 286, h: 158 }, 7, AREA).parts).toBe(1);
  });

  test("bred figur: inte fler delar än det lönar sig", () => {
    // Bredden begränsar; tre delar ger inte större text än två
    const plan = planSplit({ x: 0, y: 0, w: 700, h: 400 }, 6, AREA);
    expect(plan.parts).toBeLessThan(3);
  });

  test("textstorlek mäts i rutan; bild utan text ger undefined", () => {
    const p = page(Array.from({ length: 8 }, (_, i) => ({ str: `Row ${i} 12 (3.4)`, h: 7 })));
    expect(textSize(p, { x: 40, y: 600, w: 300, h: 200 })).toBe(7);
    expect(textSize(p, { x: 40, y: 0, w: 300, h: 100 })).toBeUndefined();
  });

  test("snitten läggs i tomma band nära jämna delar, aldrig genom tryck", () => {
    // 300 rader: tryck överallt utom band vid 95–104 och 205–214
    const ink = Array.from({ length: 300 }, (_, y) =>
      (y >= 95 && y < 105) || (y >= 205 && y < 215) ? 0 : 40,
    );
    expect(findCuts(ink, 3)).toEqual([100, 210]);
    // Inget tomt band nära mitten: går inte att dela i två
    expect(findCuts(ink, 2)).toBeNull();
  });

  test("en ram runt figuren hindrar inte snitt", () => {
    // 20 × 30 bildpunkter: lodräta ramlinjer i kolumn 0 och 19, tryck i två block
    const w = 20;
    const h = 30;
    const dark = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      dark[y * w] = 1;
      dark[y * w + w - 1] = 1;
      if (y < 12 || y >= 18) for (let x = 3; x < 17; x++) dark[y * w + x] = 1;
    }
    const ink = inkProfile(dark, w, h);
    expect(ink.slice(12, 18)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(findCuts(ink, 2)).toEqual([15]);
  });
});

// --- Annals of Oncology -----------------------------------------------------------

describe("Annals", () => {
  test("sista raden i spalten nära sidans nederkant är löptext, inte sidfot", () => {
    const rows: [string, number, number, number, string][] = [];
    for (let i = 0; i < 20; i++)
      rows.push([
        "Ordinary body text that runs across the full column width.",
        55,
        300 - i * 12,
        10,
        "R",
      ]);
    rows.push(["At a median follow-up duration of 22 months, the esti-", 65, 53, 10, "R"]);
    rows.push(["mated 2-year EFS rate was 89.7% (95% CI 87.4% to 92%) in", 55, 41, 10, "R"]);
    rows.push([
      "the camrelizumab group, corresponding to an HR of 0.67 (95% CI 0.34-1.33).",
      315,
      720,
      10,
      "R",
    ]);
    const p = fonted(rows, 5);
    const [e] = findEffects([p]);
    expect(e.quote).toContain("the estimated 2-year EFS rate");
  });

  test("skillnad där värdet står på nästa rad", () => {
    const p = page([
      "in the chemotherapy-alone group. The between-group difference",
      "was 12.6% (95% CI 0.1% to 25.1%), with a one-sided P value of 0.011.",
    ]);
    const [e] = findEffects([p]);
    expect(e.measure).toBe("Skillnad");
    expect(e.est).toBe("12.6");
  });

  test("FUNDING och DISCLOSURE i versaler; avsnittet slutar vid REFERENCES", () => {
    const p = page([
      "FUNDING",
      "This work was supported by grants from the National Natural Science Foundation of China.",
      "DISCLOSURE",
      "ZP and YX are employees of Jiangsu Hengrui Pharmaceuticals Co., Ltd. All other authors have declared no conflicts of interest.",
      "REFERENCES",
      "1. Bianchini G, De Angelis C, Licata L, Gianni L. Treatment landscape of triple-negative breast cancer.",
    ]);
    const s = findSections([p]);
    expect(s.funding?.text.startsWith("This work was supported by grants")).toBe(true);
    expect(s.coi?.text).toBe(
      "ZP and YX are employees of Jiangsu Hengrui Pharmaceuticals Co., Ltd. All other authors have declared no conflicts of interest.",
    );
  });
});

describe("snitt efter text och bild", () => {
  test("snitt tillåts i små glapp mellan textrader, inte inne i en kurvplot", () => {
    // Rutan 0–400 pt; tabellrader överst (glapp 2 pt), sedan 200 pt plot utan text
    const rows: [string, number, number, number, string][] = [];
    for (let i = 0; i < 8; i++) rows.push([`Row label ${i}`, 10, 390 - i * 10, 8, "R"]);
    rows.push(["Number at risk", 10, 100, 8, "R"]);
    for (let i = 0; i < 5; i++) rows.push([`${i * 20}`, 10, 300 - i * 40, 8, "R"]); // axelsiffror räknas inte
    const p = fonted(rows, 1);
    const allowed = cutRows(p, { x: 0, y: 0, w: 300, h: 400 }, 1)!;
    expect(allowed[11]).toBe(true); // mellan två tabellrader (rad 0 slutar vid 10, rad 1 börjar vid 12)
    expect(allowed[200]).toBe(false); // inne i plotten
  });

  test("ett helt tomt band går före ett band med tunna linjer", () => {
    // 200 rader: helt tomt vid 80–89, bara en tunn linje vid 98–107
    const ink = Array.from({ length: 200 }, (_, y) =>
      y >= 80 && y < 90 ? 0 : y >= 98 && y < 108 ? 2 : 50,
    );
    expect(findCuts(ink, 2, { tolerance: 4 })).toEqual([85]);
    // Utan helt tomt band används det med tunna linjer
    const ink2 = ink.map((v, y) => (y >= 80 && y < 90 ? 50 : v));
    expect(findCuts(ink2, 2, { tolerance: 4 })).toEqual([103]);
  });
});

// --- Clinical Cancer Research -----------------------------------------------------

describe("CCR", () => {
  test('etikett ensam på raden: bildtexten är nästa rad, och "vs." avslutar inte', () => {
    const p = fonted([
      ["Figure 1.", 53, 133, 7, "Bold"],
      ["Effect of avelumab vs. observation in TIL-defined groups. A, DDFS in", 53, 124, 7, "Reg"],
      ["patients with high BSL-TILs.", 53, 115, 7, "Reg"],
    ]);
    expect(findCaptions([p])[0].text).toBe(
      "Effect of avelumab vs. observation in TIL-defined groups.",
    );
  });

  test("decimal före parentes är ingen meningsgräns", () => {
    const p = page([
      "At a median follow-up of 52 months, the effect was consistent [DFS: HR, 0.89 (95% CI, 0.63-1.25);",
      "DDFS: HR, 0.75 (95% CI, 0.52-1.08)].",
    ]);
    const [, ddfs] = findEffects([p]);
    expect(ddfs.quote.startsWith("At a median follow-up")).toBe(true);
  });

  test("citat som börjar mitt i en mening (från förra sidan) markeras med …", () => {
    const p = page([
      "B; Supplementary Fig. S4), there was a benefit (unadjusted HR, 0.31 (95% CI, 0.11-0.87)).",
    ]);
    expect(findEffects([p])[0].quote.startsWith("… B; Supplementary")).toBe(true);
  });

  test("bindestreck före versal står kvar vid radbrytning", () => {
    expect(normalize("BSL-\nTILs had a limited impact")).toBe("BSL-TILs had a limited impact");
  });

  test("nästan läsbar hel figur delas inte", () => {
    // 8,5 pt hel: över 90 % av gränsen
    expect(planSplit({ x: 0, y: 0, w: 482, h: 224 }, 7, { w: 9, h: 3.77 }).parts).toBe(1);
  });
});

// --- Tabellhuvud och rubrikrader vid snitt --------------------------------------

describe("tabellhuvud och rubrikrader", () => {
  // Tabell i rutan 0–400 pt: bildtext, huvud i två rader, grupprubrik, datarader
  function table(): PdfPage {
    const rows: [string, number, number, number, string][] = [
      ["Table 1. Baseline characteristics", 10, 390, 8, "B"],
      ["Patients, No. (%)", 200, 376, 7, "R"],
      ["Characteristic", 10, 364, 7, "R"],
      ["Fovinaciclib (n = 208)", 200, 364, 7, "R"],
      ["Placebo (n = 209)", 300, 364, 7, "R"],
      ["Sex", 10, 350, 7, "R"],
      ["Female", 20, 338, 7, "R"],
      ["208 (100)", 200, 338, 7, "R"],
      ["209 (100)", 300, 338, 7, "R"],
      ["gBRCA status", 10, 200, 7, "R"],
      ["Mutated", 20, 188, 7, "R"],
      ["31 (10.5)", 200, 188, 7, "R"],
      ["14 (15.2)", 300, 188, 7, "R"],
    ];
    return fonted(rows, 1);
  }
  const box = { x: 0, y: 0, w: 400, h: 400 };

  test("huvudet slutar efter sista raden med flera celler före första dataraden", () => {
    // "Characteristic | Fovinaciclib (n = 208) | Placebo (n = 209)" slutar 43 pt
    // under rutans överkant; grupprubriken "Sex" (43 pt ned) hör inte till huvudet
    const end = tableHeader(table(), box)!;
    expect(end).toBeGreaterThan(36);
    expect(end).toBeLessThan(43);
  });

  test("en ensam vänsterställd rubrikrad märks, en datarad inte", () => {
    const rows = pixelRows(table(), box, 1);
    const at = (t: number) => rows.find((r) => r.top <= t && r.bottom >= t)!;
    expect(at(195).heading).toBe(true); // gBRCA status
    expect(at(207).heading).toBe(false); // Mutated 31 (10.5) …
  });

  test("snittet flyttas upp förbi en rubrikrad som annars står sist", () => {
    // 400 rader: tryck på textraderna, tomt däremellan
    const rows = pixelRows(table(), box, 1);
    const ink = Array.from({ length: 400 }, (_, y) =>
      rows.some((r) => y >= r.top && y < r.bottom) ? 30 : 0,
    );
    // Utan rader hamnar snittet närmast mitten, under "gBRCA status"
    const plain = findCuts(ink, 2)![0];
    expect(plain).toBeGreaterThan(200);
    // Med rader står snittet ovanför rubriken
    const moved = findCuts(ink, 2, { rows })![0];
    expect(moved).toBeLessThan(193);
  });
});

describe("uppdelning med upprepat huvud", () => {
  test("planen räknar med huvudet på varje del", () => {
    const box = { x: 0, y: 0, w: 486, h: 449 };
    const area = { w: 9, h: 3.77 };
    // Utan huvud räcker två delar; med ett 80 pt högt huvud på varje del behövs tre
    expect(planSplit(box, 7.47, area).parts).toBe(2);
    expect(planSplit(box, 7.47, area, 80).parts).toBe(3);
  });

  test("snitten delar raderna under huvudet jämnt", () => {
    // 1000 rader, huvud 0–200, tomma band var tionde rad
    const ink = Array.from({ length: 1000 }, (_, y) => (y % 10 < 3 ? 0 : 20));
    const [c1, c2] = findCuts(ink, 3, { start: 200 })!;
    // Delar om ungefär 267 rader under huvudet, inte 333 från bildens överkant
    expect(Math.abs(c1 - 467)).toBeLessThan(10);
    expect(Math.abs(c2 - 733)).toBeLessThan(10);
// --- Stycken till checklistan ----------------------------------------------------

describe("stycken till checklistan", () => {
  /** En sida med rader i en spalt; rubriker som egna korta rader. */
  function doc(...pgs: string[][]): PdfPage[] {
    return pgs.map((rows, n) => ({
      page: n + 1,
      width: 595,
      height: 792,
      items: rows.map((str, i) => ({
        str,
        x: 50,
        y: 740 - i * 12,
        w: str.length * 4.4,
        h: 9,
        eol: true,
      })),
    }));
  }
  const long = (s: string) => s.padEnd(80, " ") + " ";

  test("rätt avsnitt före abstractet; rubrikrad klistras inte ihop med meningen", () => {
    const pages = doc(
      [
        long("METHODS"),
        long("The primary end point was overall survival in the abstract population here."),
      ],
      [
        "Introduction",
        long("Prior trials of this class were randomized and showed a benefit in other settings."),
        long("Here, we report the final analysis of the TEST-1 trial in early breast cancer."),
        "Methods",
        "End Points",
        long(
          "The primary end point was invasive disease-free survival assessed by the investigators.",
        ),
        long(
          "Patients were eligible if they had stage II or III disease and adequate organ function.",
        ),
        long(
          "The detailed eligibility criteria have been reported previously in the protocol paper.",
        ),
      ],
      [
        "Discussion",
        long(
          "This study has several limitations. First, the trial was open label. Second, follow-up is short.",
        ),
        long("In conclusion, the combination improved outcomes in this population of patients."),
        "References",
        long("1. Some reference with limitations in the title that should never be read at all."),
      ],
    );
    const ps = findPassages(pages);
    const by = (k: string) => ps.filter((p) => p.kind === k);
    expect(by("aim")[0].text.startsWith("Here, we report")).toBe(true);
    expect(by("primaryEndpoint")[0].text.startsWith("The primary end point was invasive")).toBe(
      true,
    );
    expect(by("primaryEndpoint")[0].page).toBe(2);
    // Hänvisningen till tidigare publikation kommer efter den riktiga meningen
    expect(by("population")[0].text.startsWith("Patients were eligible")).toBe(true);
    expect(by("limitations")[0].text).toContain("Second, follow-up is short.");
    expect(by("conclusion")[0].text.startsWith("In conclusion")).toBe(true);
    expect(ps.some((p) => p.text.includes("Some reference"))).toBe(false);
  });

  test("begränsningar hos tidigare behandling räknas inte som studiens egna", () => {
    const pages = doc(
      [],
      [
        "Introduction",
        long(
          "These limitations underscore the need for optimized, de-escalated chemotherapy backbones.",
        ),
        "Discussion",
        long("Our findings are consistent with earlier trials in the same setting and population."),
      ],
    );
    expect(findPassages(pages).filter((p) => p.kind === "limitations")).toHaveLength(0);
  });
});
