/**
 * Känner igen rättelser, indragningar, förbehåll och kommentarer/brev utifrån
 * hur titeln börjar. Det är en tolkning av titeln och visas som en sådan.
 *
 * Undantag: anger PubMed publikationstypen "Retracted Publication" har
 * artikeln själv dragits tillbaka, och då märks den som indragen oavsett titel.
 */

export type NoticeKind = "retraction" | "concern" | "correction" | "comment";

export type Notice = { kind: NoticeKind; label: string; fromPubMed?: boolean };

const RULES: { kind: NoticeKind; label: string; re: RegExp }[] = [
  {
    kind: "retraction",
    label: "Indragen",
    re: /^\W*(retraction( note| notice)?|retracted|notice of retraction)\b/i,
  },
  {
    kind: "concern",
    label: "Förbehåll",
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

/** Som noticeType, men PubMeds "Retracted Publication" går före titeln. */
export function noticeFor(
  title: string | undefined | null,
  publicationTypes?: unknown,
): Notice | null {
  if (Array.isArray(publicationTypes) && publicationTypes.includes("Retracted Publication")) {
    return { kind: "retraction", label: "Indragen", fromPubMed: true };
  }
  return noticeType(title);
}
