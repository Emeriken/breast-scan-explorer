import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrialDetails } from "@/components/TrialStudy";
import type { Article } from "@/lib/articles";
import type { DeckPdf } from "@/lib/jc-pptx";
import {
  analyzePdf,
  effectLabel,
  suggestBox,
  type Box,
  type Caption,
  type Effect,
  type PdfFindings,
  type PdfPage,
} from "@/lib/pdf-extract";
import { canvasPng, openPdf, renderPage, toPdfPoint, type PdfDoc } from "@/lib/pdf-read";
import { fetchTrial, type Trial } from "@/lib/trials";
import { cn } from "@/lib/utils";

/**
 * Artikelns PDF i journal club. PDF:en läses i webbläsaren och laddas aldrig
 * upp. Effektmått, figurer och tabeller, studienummer och avsnitten om
 * finansiering och jäv hittas med mönstersökning (ingen AI); presentatören
 * väljer vad som ska med i PowerPoint-presentationen.
 */

const CAPTION_NAME = { figure: "Figur", table: "Tabell" } as const;
const captionName = (c: Caption) => `${CAPTION_NAME[c.kind]} ${c.num}`;

type Loaded = { doc: PdfDoc; pages: PdfPage[]; findings: PdfFindings; fileName: string };
type FigurePick = { id: string; box: Box };

/** Det som behövs för att bygga presentationen, eller null utan PDF. */
export type PdfDeckSource = () => Promise<DeckPdf>;

export function PdfImport({
  article,
  onChange,
}: {
  article: Article;
  /** Anropas när valen ändras; null när ingen PDF är vald */
  onChange: (source: PdfDeckSource | null, summary: string | null) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Val
  const [rows, setRows] = useState<{ 1?: string; 2?: string }>({});
  const [figures, setFigures] = useState<FigurePick[]>([]);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [useFunding, setUseFunding] = useState(true);
  const [useCoi, setUseCoi] = useState(true);
  const [nct, setNct] = useState<string | null>(null);
  const [trial, setTrial] = useState<Trial | null | "loading">(null);
  const hasTrial = Boolean(article.trials?.studies.length);

  const reset = useCallback(() => {
    setLoaded((prev) => {
      void prev?.doc.loadingTask.destroy();
      return null;
    });
    setRows({});
    setFigures([]);
    setBoxes({});
    setNct(null);
    setTrial(null);
    setError(null);
  }, []);

  // Ny artikel: släpp den gamla PDF:en
  useEffect(() => reset, [article.url, reset]);

  const load = async (file: File) => {
    if (file.type && file.type !== "application/pdf") {
      setError("Filen är ingen PDF.");
      return;
    }
    reset();
    setBusy(true);
    try {
      const { doc, pages } = await openPdf(await file.arrayBuffer());
      const findings = analyzePdf(pages);
      setBoxes(
        Object.fromEntries(findings.captions.map((c) => [c.id, suggestBox(pages[c.page - 1], c)])),
      );
      setLoaded({ doc, pages, findings, fileName: file.name });
      // Studienummer vid "registered" o.d. föreslås när artikeln saknar studie
      const reg = findings.ncts.find((n) => n.registration);
      if (!hasTrial && reg) setNct(reg.nct);
      setOpen(true);
    } catch {
      setError("Kunde inte läsa PDF:en. Är den skyddad eller trasig?");
    } finally {
      setBusy(false);
    }
  };

  // Hämta studien från registret när ett nummer väljs
  useEffect(() => {
    if (!nct) {
      setTrial(null);
      return;
    }
    let live = true;
    setTrial("loading");
    void fetchTrial(nct).then((t) => live && setTrial(t));
    return () => {
      live = false;
    };
  }, [nct]);

  // Meddela förälderns PowerPoint-del när valen ändras
  useEffect(() => {
    if (!loaded) {
      onChange(null, null);
      return;
    }
    const f = loaded.findings;
    const effects = ([1, 2] as const).flatMap((row) => {
      const e = f.effects.find((x) => x.id === rows[row]);
      return e ? [{ row, label: effectLabel(e), quote: e.quote, page: e.page }] : [];
    });
    const chosen = figures
      .map((p) => ({ cap: f.captions.find((c) => c.id === p.id)!, box: boxes[p.id] ?? p.box }))
      .filter((x) => x.cap);
    const funding =
      useFunding && f.funding ? { text: f.funding.text, page: f.funding.page } : undefined;
    const coi = useCoi && f.coi ? { text: f.coi.text, page: f.coi.page } : undefined;
    const studyTrial = trial && trial !== "loading" ? trial : null;
    const source: PdfDeckSource = async () => ({
      effects,
      funding,
      coi,
      trials: studyTrial
        ? { studies: [studyTrial], checkedAt: new Date().toISOString(), source: "pdf" }
        : undefined,
      figures: await Promise.all(
        chosen.map(async ({ cap, box }) => {
          const canvas = await renderPage(loaded.doc, cap.page, { scale: 3, box });
          return {
            title: `${captionName(cap)}: ${shorten(cap.text, 70)}`,
            label: captionName(cap).toLowerCase(),
            png: await canvasPng(canvas),
            width: canvas.width,
            height: canvas.height,
          };
        }),
      ),
    });
    const parts = [
      effects.length && `${effects.length} effektmått`,
      chosen.length &&
        `${chosen.length} ${chosen.length === 1 ? "figur eller tabell" : "figurer och tabeller"}`,
      studyTrial && studyTrial.nct,
      (funding || coi) && "finansiering och jäv",
    ].filter(Boolean);
    onChange(source, parts.length ? parts.join(" · ") : null);
  }, [loaded, rows, figures, boxes, useFunding, useCoi, trial, onChange]);

  const f = loaded?.findings;

  return (
    <section
      className={cn(
        "rounded-md border bg-card px-5 py-5 transition-colors sm:px-6 print:hidden",
        drag ? "border-foreground/50 bg-muted" : "border-border",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void load(file);
      }}
      aria-label="Artikelns PDF"
    >
      <h2 className="text-heading font-semibold tracking-[-0.01em]">Artikelns PDF</h2>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = "";
        }}
      />

      {!loaded && !busy && (
        <>
          <p className="mt-1 text-meta text-pretty text-muted-foreground">
            Dra in PDF:en eller välj filen. Effektmått, figurer, tabeller, studienummer och
            finansiering hittas automatiskt, och du väljer vad som ska med i presentationen. PDF:en
            läses bara i din webbläsare och laddas inte upp.
          </p>
          <Button variant="outline" className="mt-3" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" />
            Välj PDF
          </Button>
        </>
      )}

      {busy && (
        <p className="mt-3 inline-flex items-center gap-2 text-meta text-ink-2" role="status">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Läser PDF:en…
        </p>
      )}

      {error && (
        <p className="mt-3 text-meta font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {loaded && f && (
        <div className="mt-2 flex flex-col gap-3">
          <p className="flex min-w-0 items-center gap-2 text-meta text-ink-2">
            <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate" title={loaded.fileName}>
              {loaded.fileName}
            </span>
            <span className="shrink-0 text-muted-foreground">· {f.pages} sidor</span>
            <button
              type="button"
              onClick={reset}
              className="hit-area ml-auto shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label="Ta bort PDF:en"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </p>
          {f.noText ? (
            <p className="text-meta text-pretty text-muted-foreground">
              PDF:en verkar sakna textlager (inskannad), så inget kunde hittas automatiskt.
            </p>
          ) : (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-meta">
              <dt className="text-muted-foreground">Effektmått</dt>
              <dd className="text-ink-2">
                {(rows[1] ? 1 : 0) + (rows[2] ? 1 : 0)} valda av {f.effects.length}
              </dd>
              <dt className="text-muted-foreground">Figurer, tabeller</dt>
              <dd className="text-ink-2">
                {figures.length} valda av {f.captions.length}
              </dd>
              <dt className="text-muted-foreground">Studie</dt>
              <dd className="truncate text-ink-2">
                {hasTrial
                  ? "finns redan för artikeln"
                  : nct
                    ? `${nct} ur PDF:en`
                    : f.ncts.length
                      ? "inget valt"
                      : "inget nummer hittades"}
              </dd>
              <dt className="text-muted-foreground">Finansiering, jäv</dt>
              <dd className="text-ink-2">
                {[f.funding && useFunding && "finansiering", f.coi && useCoi && "jäv"]
                  .filter(Boolean)
                  .join(" och ") || "inget med"}
              </dd>
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={f.noText}>
              Välj ur PDF:en
            </Button>
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              Byt PDF
            </Button>
          </div>
        </div>
      )}

      {loaded && f && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92vh] w-[min(64rem,calc(100vw-2rem))] max-w-none overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Välj ur artikelns PDF</DialogTitle>
              <DialogDescription>
                Förslagen kommer från mönstersökning i PDF:ens text, utan AI. Kontrollera mot
                artikeln; sidnumret står vid varje träff.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="effects">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="effects">Effektmått ({f.effects.length})</TabsTrigger>
                <TabsTrigger value="figures">
                  Figurer och tabeller ({f.captions.length})
                </TabsTrigger>
                <TabsTrigger value="study">Studie och finansiering</TabsTrigger>
              </TabsList>
              <TabsContent value="effects" className="mt-4">
                <EffectsTab effects={f.effects} rows={rows} setRows={setRows} />
              </TabsContent>
              <TabsContent value="figures" className="mt-4">
                <FiguresTab
                  doc={loaded.doc}
                  captions={f.captions}
                  boxes={boxes}
                  setBox={(id, box) => setBoxes((b) => ({ ...b, [id]: box }))}
                  resetBox={(c) =>
                    setBoxes((b) => ({ ...b, [c.id]: suggestBox(loaded.pages[c.page - 1], c) }))
                  }
                  picked={figures}
                  setPicked={setFigures}
                />
              </TabsContent>
              <TabsContent value="study" className="mt-4">
                <StudyTab
                  findings={f}
                  hasTrial={hasTrial}
                  articleTrials={article.trials?.studies.map((t) => t.nct) ?? []}
                  nct={nct}
                  setNct={setNct}
                  trial={trial}
                  useFunding={useFunding}
                  setUseFunding={setUseFunding}
                  useCoi={useCoi}
                  setUseCoi={setUseCoi}
                />
              </TabsContent>
            </Tabs>
            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => setOpen(false)}>Klar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

function shorten(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (t.length <= n) return t;
  const cut = t.lastIndexOf(" ", n);
  return `${t.slice(0, cut > 30 ? cut : n)}…`;
}

// --- Effektmått ------------------------------------------------------------

function EffectsTab({
  effects,
  rows,
  setRows,
}: {
  effects: Effect[];
  rows: { 1?: string; 2?: string };
  setRows: (r: { 1?: string; 2?: string }) => void;
}) {
  if (!effects.length)
    return (
      <p className="text-sm text-pretty text-muted-foreground">
        Inga effektmått med konfidensintervall hittades, till exempel "HR 0.60 (95% CI 0.45–0.80)".
        De kan stå i en tabell eller i ett ovanligt format. Fyll då i resultattabellen själv.
      </p>
    );
  const toggle = (row: 1 | 2, id: string) => {
    const next = { ...rows };
    if (next[row] === id) delete next[row];
    else {
      next[row] = id;
      const other = row === 1 ? 2 : 1;
      if (next[other] === id) delete next[other];
    }
    setRows(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-pretty text-muted-foreground">
        Välj effektmåttet för det primära och ett sekundärt utfall. De hamnar i resultattabellen på
        bild 4, och meningen med sidnummer i anteckningarna.
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {effects.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {effectLabel(e)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  sidan {e.page}
                </span>
              </p>
              <p className="mt-0.5 text-meta text-pretty text-ink-2">{e.quote}</p>
            </div>
            <div
              className="flex shrink-0 gap-1.5"
              role="group"
              aria-label={`Använd ${effectLabel(e)} som`}
            >
              {([1, 2] as const).map((row) => (
                <Button
                  key={row}
                  size="sm"
                  variant={rows[row] === e.id ? "default" : "outline"}
                  aria-pressed={rows[row] === e.id}
                  onClick={() => toggle(row, e.id)}
                >
                  {row === 1 ? "Primärt" : "Sekundärt"}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Figurer och tabeller -------------------------------------------------------

function useThumb(doc: PdfDoc, page: number, box: Box | undefined, scale: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void renderPage(doc, page, { scale, box }).then(
      (c) => live && setUrl(c.toDataURL("image/png")),
    );
    return () => {
      live = false;
    };
  }, [doc, page, box, scale]);
  return url;
}

function Thumb({ doc, cap, box }: { doc: PdfDoc; cap: Caption; box: Box }) {
  const url = useThumb(doc, cap.page, box, 1.2);
  return url ? (
    <img
      src={url}
      alt={`${captionName(cap)}, förhandsvisning`}
      className="h-full w-full object-contain"
    />
  ) : (
    <div className="h-full w-full animate-pulse bg-muted" />
  );
}

function FiguresTab({
  doc,
  captions,
  boxes,
  setBox,
  resetBox,
  picked,
  setPicked,
}: {
  doc: PdfDoc;
  captions: Caption[];
  boxes: Record<string, Box>;
  setBox: (id: string, box: Box) => void;
  resetBox: (c: Caption) => void;
  picked: FigurePick[];
  setPicked: (p: FigurePick[]) => void;
}) {
  const [editing, setEditing] = useState<Caption | null>(null);
  if (editing)
    return (
      <CropEditor
        doc={doc}
        cap={editing}
        box={boxes[editing.id]}
        onSave={(b) => {
          setBox(editing.id, b);
          setEditing(null);
        }}
        onReset={() => {
          resetBox(editing);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  if (!captions.length)
    return (
      <p className="text-sm text-pretty text-muted-foreground">
        Inga bildtexter som "Figure 1" eller "Table 1" hittades.
      </p>
    );
  const order = (id: string) => picked.findIndex((p) => p.id === id);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-pretty text-muted-foreground">
        Valda figurer och tabeller blir egna bilder i presentationen, i den ordning du väljer dem,
        med källrad. Rutan är ett förslag; justera den om något saknas eller kommer med i onödan.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {captions.map((c) => {
          const i = order(c.id);
          return (
            <li
              key={c.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-md border",
                i >= 0 ? "border-foreground" : "border-border",
              )}
            >
              <div className="relative aspect-[4/3] bg-white">
                <Thumb doc={doc} cap={c} box={boxes[c.id]} />
                {i >= 0 && (
                  <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 border-t border-border p-3">
                <p className="text-meta text-ink-2">
                  <span className="font-semibold text-foreground">{captionName(c)}</span>
                  <span className="text-muted-foreground"> · sidan {c.page}</span>
                  <span className="mt-0.5 line-clamp-2 block">{c.text}</span>
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-meta">
                    <Checkbox
                      checked={i >= 0}
                      onCheckedChange={(on) =>
                        setPicked(
                          on
                            ? [...picked, { id: c.id, box: boxes[c.id] }]
                            : picked.filter((p) => p.id !== c.id),
                        )
                      }
                    />
                    Ta med
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                    Justera ruta
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hela sidan med rutan; dra en ny ruta med musen eller fingret. */
function CropEditor({
  doc,
  cap,
  box,
  onSave,
  onReset,
  onCancel,
}: {
  doc: PdfDoc;
  cap: Caption;
  box: Box;
  onSave: (b: Box) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const SCALE = 1.4;
  const url = useThumb(doc, cap.page, undefined, SCALE);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Föreslagen ruta i bildens pixlar
  useEffect(() => {
    let live = true;
    void (async () => {
      const page = await doc.getPage(cap.page);
      const vp = page.getViewport({ scale: SCALE });
      const [x1, y1] = vp.convertToViewportPoint(box.x, box.y);
      const [x2, y2] = vp.convertToViewportPoint(box.x + box.w, box.y + box.h);
      if (live)
        setRect({
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          w: Math.abs(x2 - x1),
          h: Math.abs(y2 - y1),
        });
    })();
    return () => {
      live = false;
    };
  }, [doc, cap.page, box]);

  /** Pekarens position i den renderade sidans pixlar */
  const at = (e: PointerEvent) => {
    const el = imgRef.current!;
    const r = el.getBoundingClientRect();
    const k = el.naturalWidth / r.width;
    return {
      x: Math.max(0, Math.min(el.naturalWidth, (e.clientX - r.left) * k)),
      y: Math.max(0, Math.min(el.naturalHeight, (e.clientY - r.top) * k)),
    };
  };

  const save = async () => {
    if (!rect || rect.w < 8 || rect.h < 8) return;
    const [ax, ay] = await toPdfPoint(doc, cap.page, SCALE, rect.x, rect.y + rect.h);
    const [bx, by] = await toPdfPoint(doc, cap.page, SCALE, rect.x + rect.w, rect.y);
    onSave({
      x: Math.min(ax, bx),
      y: Math.min(ay, by),
      w: Math.abs(bx - ax),
      h: Math.abs(by - ay),
    });
  };

  const k = imgRef.current
    ? imgRef.current.getBoundingClientRect().width / imgRef.current.naturalWidth
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-pretty text-muted-foreground">
        <span className="font-semibold text-foreground">{captionName(cap)}</span>, sidan {cap.page}.
        Dra med musen eller fingret runt det som ska med.
      </p>
      <div className="relative mx-auto w-full max-w-3xl touch-none select-none overflow-hidden rounded-md border border-border bg-white">
        {url ? (
          <img
            ref={imgRef}
            src={url}
            alt={`Sidan ${cap.page}`}
            draggable={false}
            className="block w-full cursor-crosshair"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = at(e);
              start.current = p;
              setRect({ x: p.x, y: p.y, w: 0, h: 0 });
            }}
            onPointerMove={(e) => {
              if (!start.current) return;
              const p = at(e);
              const s = start.current;
              setRect({
                x: Math.min(s.x, p.x),
                y: Math.min(s.y, p.y),
                w: Math.abs(p.x - s.x),
                h: Math.abs(p.y - s.y),
              });
            }}
            onPointerUp={() => {
              start.current = null;
            }}
          />
        ) : (
          <div className="aspect-[3/4] w-full animate-pulse bg-muted" />
        )}
        {rect && k > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-destructive bg-destructive/5"
            style={{ left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k }}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onReset}>
          Föreslagen ruta
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Avbryt
        </Button>
        <Button onClick={() => void save()} disabled={!rect || rect.w < 8 || rect.h < 8}>
          Spara ruta
        </Button>
      </div>
    </div>
  );
}

// --- Studie och finansiering ---------------------------------------------------

function StudyTab({
  findings: f,
  hasTrial,
  articleTrials,
  nct,
  setNct,
  trial,
  useFunding,
  setUseFunding,
  useCoi,
  setUseCoi,
}: {
  findings: PdfFindings;
  hasTrial: boolean;
  articleTrials: string[];
  nct: string | null;
  setNct: (n: string | null) => void;
  trial: Trial | null | "loading";
  useFunding: boolean;
  setUseFunding: (v: boolean) => void;
  useCoi: boolean;
  setUseCoi: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-sm font-semibold">Registrerad studie</h3>
        {hasTrial ? (
          <p className="mt-1 text-meta text-pretty text-muted-foreground">
            Artikeln har redan studien {articleTrials.join(", ")} från ClinicalTrials.gov. Den finns
            med i anteckningarna till bild 3.
            {f.ncts.length > 0 &&
              !f.ncts.some((n) => articleTrials.includes(n.nct)) &&
              ` PDF:en nämner andra nummer: ${f.ncts.map((n) => n.nct).join(", ")}.`}
          </p>
        ) : f.ncts.length === 0 ? (
          <p className="mt-1 text-meta text-muted-foreground">
            Inget NCT-nummer hittades i PDF:en.
          </p>
        ) : (
          <>
            <p className="mt-1 text-meta text-pretty text-muted-foreground">
              Välj artikelns egen studie. Nummer som står vid "registered" eller
              "ClinicalTrials.gov" står först; övriga är oftast citerade studier. Uppgifterna hämtas
              från ClinicalTrials.gov till anteckningarna för bild 3.
            </p>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Studienummer i PDF:en"
            >
              {f.ncts.map((n) => (
                <Button
                  key={n.nct}
                  size="sm"
                  variant={nct === n.nct ? "default" : "outline"}
                  aria-pressed={nct === n.nct}
                  onClick={() => setNct(nct === n.nct ? null : n.nct)}
                >
                  {n.nct}
                  <span className="text-xs font-normal opacity-70">
                    {n.registration ? "registrering" : `sidan ${n.page}`}
                  </span>
                </Button>
              ))}
            </div>
            {trial === "loading" && (
              <p className="mt-3 inline-flex items-center gap-2 text-meta text-muted-foreground">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Hämtar från
                ClinicalTrials.gov…
              </p>
            )}
            {nct && trial === null && (
              <p className="mt-3 text-meta text-muted-foreground">
                {nct} kunde inte hämtas från ClinicalTrials.gov.
              </p>
            )}
            {trial && trial !== "loading" && (
              <div className="mt-3 rounded-md border border-border p-4">
                <TrialDetails trial={trial} />
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Finansiering och jäv</h3>
        <p className="mt-1 text-meta text-muted-foreground">
          Hamnar i anteckningarna till bild 6, för diskussionen om styrkor och begränsningar.
        </p>
        {!f.funding && !f.coi && (
          <p className="mt-2 text-meta text-muted-foreground">
            Inga avsnitt om finansiering eller jäv hittades.
          </p>
        )}
        {[
          { hit: f.funding, on: useFunding, set: setUseFunding, name: "Finansiering" },
          { hit: f.coi, on: useCoi, set: setUseCoi, name: "Jäv" },
        ].map(
          ({ hit, on, set, name }) =>
            hit && (
              <div key={name} className="mt-3 rounded-md border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2 text-meta font-medium">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => set(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    {name} med i anteckningarna
                    <span className="block font-normal text-muted-foreground">
                      Rubriken "{hit.heading}", sidan {hit.page}
                    </span>
                  </span>
                </label>
                <p className="mt-2 text-meta text-pretty text-ink-2">{hit.text}</p>
              </div>
            ),
        )}
      </section>
    </div>
  );
}
