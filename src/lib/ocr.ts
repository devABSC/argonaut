import { createWorker } from "tesseract.js";

/**
 * Free, local text extraction. Nothing leaves the server and there is no API
 * key — Tesseract runs in-process, so the only cost is CPU time.
 *
 * Use it on scans and photographs: an NBI clearance snapped on a phone, a CV
 * that is really a picture of a CV. A PDF that already has a text layer should
 * go through readPdfText() instead, which is far faster and exact.
 */

export type OcrResult = {
  text: string;
  /** Tesseract's own 0–100 confidence. Below ~60 the read is usually unusable. */
  confidence: number;
};

const IMAGE = /\.(png|jpe?g|webp|bmp|tiff?|gif)$/i;

export function isImage(fileName: string, mime?: string | null): boolean {
  return (mime?.startsWith("image/") ?? false) || IMAGE.test(fileName);
}

/**
 * `eng` only. Philippine documents are in English, and adding languages costs
 * a model download per language on first use.
 */
export async function ocrImage(bytes: Buffer): Promise<OcrResult> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(bytes);
    return { text: (data.text ?? "").trim(), confidence: data.confidence ?? 0 };
  } finally {
    // The worker holds a child process; leaking one per upload would pile up.
    await worker.terminate();
  }
}

/**
 * The text layer of a PDF, if it has one. Scanned PDFs are images in a PDF
 * wrapper and return nothing — that empty result is the signal to fall back.
 */
export async function readPdfText(bytes: Buffer): Promise<string> {
  // Legacy build: the default entry point expects browser globals.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    // No worker process in Node; the main thread does the parsing.
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  await doc.cleanup();
  return pages.filter(Boolean).join("\n\n");
}

/** Enough words to be a real read rather than noise from a failed one. */
export function looksLikeText(s: string): boolean {
  return s.replace(/\s+/g, " ").trim().split(" ").length >= 40;
}
