/**
 * Känner igen rättelser, indragningar, förbehåll och kommentarer/brev utifrån
 * hur titeln börjar. Datat innehåller inte PubMeds publikationstyp, så det här
 * är en tolkning av titeln och visas som en sådan.
 */

export type NoticeKind = "retraction" | "concern" | "correction" | "comment";

export type Notice = { kind: NoticeKind; label: string };

const RULES: { kind: NoticeKind; label: string; re: RegExp }[] = [
  {
    kind: "retraction",
    label: "Indragen",
    re: /^\W*(retraction( note| notice)?|retracted|notice of retraction)\b/i,
  },
  {
    kind: "concern",
    label: "Expression of concern",
    re: /^\W*(editorial )?expression of concern\b/i,
  },
  {
    kind: "correction",
    label: "Rättelse",
    re: /^\W*(correction|erratum|corrigendum)\b/i,
  },
  {
    kind: "comment",
    label: "Kommentar",
    re: /^\W*(letter to the editor|comments? on\b|reply to\b|authors?['’]?s?['’]? reply\b|in reply\b|re:|response to (the )?(correspondence|letter|comments?)\b)/i,
  },
];

export function noticeType(title: string | undefined | null): Notice | null {
  if (!title) return null;
  const hit = RULES.find((r) => r.re.test(title));
  return hit ? { kind: hit.kind, label: hit.label } : null;
}
