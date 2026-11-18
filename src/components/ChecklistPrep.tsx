import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { DeckPrep, PrepField } from "@/lib/jc-pptx";
import type { Passage, PassageKind } from "@/lib/pdf-extract";
import { cn } from "@/lib/utils";

/**
 * Det som fylls i under varje punkt i checklistan, i samma ordning som
 * punkterna: egna fält, vilka sorters meningar ur PDF:en som föreslås och en
 * kort påminnelse om begrepp att ta upp. Appen skriver ingen egen text: förslagen
 * är ordagranna meningar ur artikeln, resten skriver presentatören.
 */
export const PREP: {
  fields: { key: PrepField; label?: string; placeholder: string }[];
  kinds: PassageKind[];
  /** Begrepp att ta upp, som påminnelse */
  concepts?: string;
}[] = [
  {
    fields: [
      {
        key: "bakgrund",
        placeholder: "Vad visste vi före studien, och vilken kunskapslucka fyller den?",
      },
    ],
    kinds: [],
  },
  {
    fields: [{ key: "fraga", placeholder: "P: …\nI: …\nC: …\nO: …" }],
    kinds: ["aim", "design"],
    concepts: "Fas, blindning, superiority eller non-inferiority, interimsanalys",
  },
  {
    fields: [
      {
        key: "population",
        placeholder: "Antal randomiserade och analyserade, viktiga inklusionskriterier",
      },
    ],
    kinds: ["population", "followUp"],
    concepts: "Uppföljningstid (median), bortfall, liknar populationen våra patienter?",
  },
  {
    fields: [{ key: "primart", placeholder: "Egen kommentar till det primära effektmåttet" }],
    kinds: ["primaryEndpoint"],
    concepts:
      "Samma primära effektmått som i studieregistret? Absolut skillnad eller NNT, inte bara HR",
  },
  {
    fields: [
      {
        key: "sekundart",
        placeholder: "Sekundära effektmått och förplanerade subgrupper (till anteckningarna)",
      },
    ],
    kinds: [],
    concepts: "Subgrupper är hypotesgenererande; var de förplanerade?",
  },
  {
    fields: [{ key: "sakerhet", placeholder: "Biverkningar grad ≥3, avbrott, livskvalitet" }],
    kinds: ["safety"],
  },
  {
    fields: [
      { key: "styrkor", label: "Styrkor", placeholder: "Design, storlek, blindning, bortfall" },
      {
        key: "begransningar",
        label: "Begränsningar, egna tillägg",
        placeholder: "Det författarna inte nämner: jämförelsearm, population, finansiering och jäv",
      },
    ],
    kinds: ["strengths", "limitations"],
  },
  {
    fields: [
      {
        key: "betydelse",
        label: "Betydelse",
        placeholder: "Vilka av våra patienter berörs? Ändrar det praxis? Slutsats i en mening.",
      },
      {
        key: "overforbarhet",
        label: "Överförbarhet",
        placeholder: "Liknar population och jämförelsearm våra patienter och vår standard?",
      },
    ],
    kinds: ["conclusion"],
  },
  {
    fields: [{ key: "diskussion", placeholder: "En fråga per rad" }],
    kinds: [],
  },
];

const KIND_LABEL: Record<PassageKind, string> = {
  aim: "Syfte",
  design: "Design",
  population: "Population",
  primaryEndpoint: "Primärt effektmått",
  followUp: "Uppföljning",
  safety: "Säkerhet",
  strengths: "Styrkor enligt författarna",
  limitations: "Begränsningar enligt författarna",
  conclusion: "Författarnas slutsats",
};

export type PrepState = {
  texts: Partial<Record<PrepField, string>>;
  /** Förslag som presentatören valt bort (meningens text) */
  excluded: string[];
};

const EMPTY: PrepState = { texts: {}, excluded: [] };

/** Checklistans text för en artikel, sparad i webbläsaren. */
export function usePrep(articleUrl: string) {
  const key = `presentation-prep:${articleUrl}`;
  const [state, setState] = useState<PrepState>(EMPTY);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let next = EMPTY;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Partial<PrepState>) : null;
      if (parsed && typeof parsed === "object")
        next = {
          texts: typeof parsed.texts === "object" && parsed.texts ? parsed.texts : {},
          excluded: Array.isArray(parsed.excluded) ? parsed.excluded.map(String) : [],
        };
    } catch {
      // Lagring blockerad eller trasig: börja tomt
    }
    setState(next);
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Lagring blockerad: texten gäller bara den här sidvisningen
    }
  }, [key, state, loadedKey]);

  const setText = useCallback(
    (field: PrepField, text: string) =>
      setState((s) => ({ ...s, texts: { ...s.texts, [field]: text } })),
    [],
  );
  const toggleQuote = useCallback(
    (text: string) =>
      setState((s) => ({
        ...s,
        excluded: s.excluded.includes(text)
          ? s.excluded.filter((t) => t !== text)
          : [...s.excluded, text],
      })),
    [],
  );
  return { state, setText, toggleQuote };
}

/** Det som går till PowerPoint-presentationen. */
export function deckPrep(state: PrepState, passages: Passage[] | null): DeckPrep {
  return {
    texts: state.texts,
    quotes: (passages ?? [])
      .filter((p) => !state.excluded.includes(p.text))
      .map(({ kind, text, page }) => ({ kind, text, page })),
  };
}

/** Fält och förslag under en punkt i checklistan, fällbara. */
export function ItemPrep({
  index,
  passages,
  state,
  setText,
  toggleQuote,
}: {
  index: number;
  /** null: ingen PDF inläst */
  passages: Passage[] | null;
  state: PrepState;
  setText: (field: PrepField, text: string) => void;
  toggleQuote: (text: string) => void;
}) {
  const prep = PREP[index];
  const [open, setOpen] = useState(false);
  const suggestions = (passages ?? []).filter((p) => prep.kinds.includes(p.kind));
  const used = suggestions.filter((p) => !state.excluded.includes(p.text)).length;
  const written = prep.fields.filter((f) => state.texts[f.key]?.trim()).length;
  const status = [
    used > 0 && `${used} ur PDF:en`,
    written > 0 && (written === 1 ? "egen text" : `${written} egna texter`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hit-area inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-foreground"
      >
        <ChevronDown
          aria-hidden
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
        {open ? "Dölj" : "Fyll i"}
        {status && <span className="font-normal text-muted-foreground">· {status}</span>}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3 border-l-2 border-border pl-3">
          {prep.kinds.length > 0 &&
            (passages === null ? (
              <p className="text-xs text-muted-foreground">
                Läs in artikelns PDF för förslag ur texten.
              </p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga förslag hittades i PDF:en.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suggestions.map((p) => {
                  const on = !state.excluded.includes(p.text);
                  return (
                    <li key={p.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`q-${p.id}`}
                        checked={on}
                        onCheckedChange={() => toggleQuote(p.text)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`q-${p.id}`} className="cursor-pointer text-xs">
                        <span className="font-medium text-foreground">{KIND_LABEL[p.kind]}</span>
                        <span className="text-muted-foreground"> · sidan {p.page}</span>
                        <span
                          className={cn(
                            "mt-0.5 line-clamp-4 block italic text-ink-2",
                            !on && "line-through opacity-60",
                          )}
                          title={p.text}
                        >
                          ”{p.text}”
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ))}
          {prep.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs">
              {f.label && <span className="font-medium text-foreground">{f.label}</span>}
              <Textarea
                value={state.texts[f.key] ?? ""}
                onChange={(e) => setText(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="min-h-0 text-sm md:text-sm"
              />
            </label>
          ))}
          {prep.concepts && (
            <p className="text-xs text-muted-foreground">Tänk på: {prep.concepts}</p>
          )}
        </div>
      )}
    </div>
  );
}
