import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import mallUrl from "@/assets/jc-mall.pptx?url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RUBRIC, roundScore } from "@/components/Score";
import { Segmented } from "@/components/Segmented";
import type { Article } from "@/lib/articles";
import { buildDeck, deckFileName, fetchAbstract } from "@/lib/jc-pptx";
import { pmidFromUrl } from "@/lib/journals";

const NAME_KEY = "brostcancer:presentator";

const AREAS = [
  { value: "Cytotoxisk behandling", label: "Cytotoxisk" },
  { value: "Endokrin behandling", label: "Endokrin" },
  { value: "Strålbehandling", label: "Strålbehandling" },
];

/**
 * Skapar en redigerbar PowerPoint på SÖS mall för artikeln. Bilderna har
 * uppgifterna från PubMed och rutor att fylla i; AI-texterna och abstractet
 * hamnar i talarens anteckningar.
 */
export function JcPowerPoint({ article, area }: { article: Article; area: string }) {
  const [name, setName] = useState("");
  // Tomt tills presentatören väljer: datumet står på titelbilden och i filnamnet
  const [date, setDate] = useState("");
  const [dateMissing, setDateMissing] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const [areaSel, setAreaSel] = useState(area);
  useEffect(() => setAreaSel(area), [area]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      setName(window.localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // Lagring blockerad
    }
  }, []);

  const create = async () => {
    if (!date) {
      setDateMissing(true);
      setMessage(null);
      dateRef.current?.focus();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      try {
        if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // Lagring blockerad: namnet gäller bara den här gången
      }
      const pmid = article.pmid ?? pmidFromUrl(article.url);
      const [template, abstract] = await Promise.all([
        fetch(mallUrl).then((r) => {
          if (!r.ok) throw new Error("mall");
          return r.arrayBuffer();
        }),
        pmid ? fetchAbstract(pmid) : Promise.resolve(null),
      ]);
      const bytes = await buildDeck(template, {
        article,
        area: areaSel,
        presenter: name,
        date,
        abstract,
        rubric: RUBRIC.find((r) => r.score === roundScore(article.relevance_score))?.text,
      });
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      const fileName = deckFileName(article, date);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(
        `Nedladdad: ${fileName}. Fyll i de grå rutorna. ` +
          (abstract
            ? "AI-texterna och abstractet finns i talarens anteckningar."
            : "AI-texterna finns i talarens anteckningar. Abstractet kunde inte hämtas från PubMed, så det saknas där."),
      );
    } catch {
      setMessage("Kunde inte skapa presentationen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-md border border-border bg-card px-5 py-5 sm:px-6 print:hidden">
      <h2 className="text-heading font-semibold tracking-[-0.01em]">PowerPoint för journal club</h2>
      <p className="mt-1 text-meta text-muted-foreground">
        Åtta bilder på SÖS mall med artikelns uppgifter från PubMed och rutor att fylla i. Appen
        skriver inga resultat eller slutsatser. AI-texterna och abstractet läggs i talarens
        anteckningar, märkta med var de kommer ifrån.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <Segmented label="Område" value={areaSel} options={AREAS} onChange={setAreaSel} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jc-namn" className="text-xs text-muted-foreground">
            Presentatör
          </Label>
          <Input
            id="jc-namn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ditt namn"
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jc-datum" className="text-xs text-muted-foreground">
            Datum för journal club
          </Label>
          <Input
            ref={dateRef}
            id="jc-datum"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value) setDateMissing(false);
            }}
            aria-invalid={dateMissing || undefined}
            aria-describedby="jc-datum-hint"
            className="w-auto"
          />
          <p
            id="jc-datum-hint"
            className={
              dateMissing
                ? "text-meta font-medium text-destructive"
                : "text-meta text-muted-foreground"
            }
          >
            {dateMissing
              ? "Välj datum först. Det står på titelbilden och i filnamnet."
              : "Står på titelbilden och i filnamnet."}
          </p>
        </div>
        <Button onClick={create} disabled={busy} className="self-start">
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Download aria-hidden className="h-4 w-4" />
          )}
          {busy ? "Skapar…" : "Skapa PowerPoint"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-meta text-ink-2 empty:hidden">
        {message}
      </p>
    </section>
  );
}
