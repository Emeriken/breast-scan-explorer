/**
 * Läser artikelns PDF i webbläsaren med pdf.js. Filen laddas aldrig upp:
 * text och bilder tas fram lokalt och finns bara kvar så länge sidan är öppen.
 * pdf.js laddas först när någon väljer en PDF, så att sidan inte blir tyngre.
 */
import type { Box, PdfPage } from "@/lib/pdf-extract";

type PdfJs = typeof import("pdfjs-dist");
export type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;

let lib: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  lib ??= (async () => {
    const [m, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    m.GlobalWorkerOptions.workerSrc = worker.default;
    return m;
  })();
  return lib;
}

/** Rutans hörn i canvas-pixlar för en viewport (pdf.js v6 saknar convertToViewportRectangle). */
function corners(
  vp: { convertToViewportPoint(x: number, y: number): number[] },
  box: Box,
): [number, number, number, number] {
  const [x1, y1] = vp.convertToViewportPoint(box.x, box.y);
  const [x2, y2] = vp.convertToViewportPoint(box.x + box.w, box.y + box.h);
  return [x1, y1, x2, y2];
}

type RawItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

/** Öppna PDF:en och läs textlagret på alla sidor. */
export async function openPdf(data: ArrayBuffer): Promise<{ doc: PdfDoc; pages: PdfPage[] }> {
  const m = await pdfjs();
  const doc = await m.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    pages.push({
      page: i,
      width: vp.width,
      height: vp.height,
      items: (tc.items as RawItem[])
        .filter((it) => typeof it.str === "string" && it.transform)
        .map((it) => ({
          str: it.str!,
          x: it.transform![4],
          y: it.transform![5],
          w: it.width ?? 0,
          h: it.height || Math.abs(it.transform![3]),
          eol: Boolean(it.hasEOL),
        })),
    });
  }
  return { doc, pages };
}

/**
 * Rendera en sida (eller en ruta på den) till en canvas. `box` är i
 * PDF-koordinater. Returnerar canvas och skalan som användes.
 */
export async function renderPage(
  doc: PdfDoc,
  pageNo: number,
  { scale, box }: { scale: number; box?: Box },
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const full = document.createElement("canvas");
  full.width = Math.ceil(vp.width);
  full.height = Math.ceil(vp.height);
  await page.render({ canvas: full, viewport: vp }).promise;
  if (!box) return full;
  const [x1, y1, x2, y2] = corners(vp, box);
  const sx = Math.max(0, Math.floor(Math.min(x1, x2)));
  const sy = Math.max(0, Math.floor(Math.min(y1, y2)));
  const sw = Math.min(full.width - sx, Math.ceil(Math.abs(x2 - x1)));
  const sh = Math.min(full.height - sy, Math.ceil(Math.abs(y2 - y1)));
  const out = document.createElement("canvas");
  out.width = Math.max(1, sw);
  out.height = Math.max(1, sh);
  out.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Omvandla en punkt på en renderad sida (canvas-pixlar) till PDF-koordinater. */
export async function toPdfPoint(
  doc: PdfDoc,
  pageNo: number,
  scale: number,
  x: number,
  y: number,
): Promise<[number, number]> {
  const vp = (await doc.getPage(pageNo)).getViewport({ scale });
  const [px, py] = vp.convertToPdfPoint(x, y);
  return [px, py];
}

/** Omvandla en ruta i PDF-koordinater till canvas-pixlar på en renderad sida. */
export async function toCanvasRect(
  doc: PdfDoc,
  pageNo: number,
  scale: number,
  box: Box,
): Promise<{ left: number; top: number; width: number; height: number }> {
  const vp = (await doc.getPage(pageNo)).getViewport({ scale });
  const [x1, y1, x2, y2] = corners(vp, box);
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Canvas som PNG-bytes, till PowerPoint. */
export function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Kunde inte skapa bilden"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png"),
  );
}
