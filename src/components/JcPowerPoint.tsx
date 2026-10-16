import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import mallUrl from "@/assets/jc-mall.pptx?url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RUBRIC, roundScore } from "@/components/Score";
import { Segmented } from "@/components/Segmented";
import { isoDay, type Article } from "@/lib/articles";
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
  const [date, setDate] = useState(() => isoDay(new Date()));
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
      a.download = deckFileName(article, date);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(
        abstract
          ? "Presentationen är nedladdad."
          : "Presentationen är nedladdad. Abstractet kunde inte hämtas från PubMed och finns därför inte i anteckningarna.",
      );
    } catch {
      setMessage("Kunde inte skapa presentationen. Försök igen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-md border border-border bg-card px-5 py-6 sm:px-8 print:hidden">
      <h2 className="text-[17px] font-semibold leading-6 tracking-[-0.01em]">
        PowerPoint för journal club
      </h2>
      <p className="mt-1 max-w-[70ch] text-sm leading-[22px] text-muted-foreground">
        Åtta bilder på SÖS mall med artikelns uppgifter från PubMed och rutor att fylla i. Appen
        skriver inga resultat eller slutsatser. AI-texterna och abstractet läggs i talarens
        anteckningar, märkta med var de kommer ifrån.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Segmented label="Journal club" value={areaSel} options={AREAS} onChange={setAreaSel} />
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
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
            id="jc-datum"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button onClick={create} disabled={busy || !date}>
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Download aria-hidden className="h-4 w-4" />
          )}
          {busy ? "Skapar…" : "Skapa PowerPoint"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-ink-2 empty:hidden">
        {message}
      </p>
    </section>
  );
}
