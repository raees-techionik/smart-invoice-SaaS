import "server-only";

import { createCanvas } from "@napi-rs/canvas";

export type ImportFileExtraction = {
  confidence?: number;
  source: string;
  textContent: string;
  warning?: string;
};

function isPlainTextFile(fileName: string, fileType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    fileType === "text/csv" ||
    fileType === "text/plain" ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".txt")
  );
}

function isPdfFile(fileName: string, fileType: string) {
  return fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

function isImageFile(fileName: string, fileType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    fileType.startsWith("image/") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  );
}

async function extractPdfText(fileBuffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
  });
  const document = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    if (pageText.trim()) {
      pageTexts.push(pageText);
    }
  }

  return pageTexts.join("\n\n");
}

async function extractImageText(fileBuffer: Buffer) {
  const tesseractModule = await import("tesseract.js");
  const tesseract = tesseractModule.default ?? tesseractModule;
  const result = await tesseract.recognize(fileBuffer, "eng");
  const confidence = Number(result.data.confidence);

  return {
    confidence: Number.isFinite(confidence) ? confidence / 100 : 0.45,
    textContent: result.data.text ?? "",
  };
}

async function renderPdfPages(fileBuffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
  });
  const document = await loadingTask.promise;
  const maxPages = Math.max(
    1,
    Math.min(Number(process.env.OCR_MAX_PDF_PAGES ?? 5), document.numPages),
  );
  const renderedPages: Buffer[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const canvasContext = canvas.getContext("2d");

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    renderedPages.push(Buffer.from(await canvas.encode("png")));
  }

  return {
    pageCount: document.numPages,
    renderedPages,
  };
}

async function extractScannedPdfText(fileBuffer: Buffer) {
  const { pageCount, renderedPages } = await renderPdfPages(fileBuffer);
  const pageResults = await Promise.all(
    renderedPages.map(async (pageBuffer, index) => {
      const result = await extractImageText(pageBuffer);

      return {
        confidence: result.confidence,
        textContent: result.textContent.trim()
          ? `Page ${index + 1}\n${result.textContent.trim()}`
          : "",
      };
    }),
  );
  const detectedText = pageResults
    .map((result) => result.textContent)
    .filter(Boolean)
    .join("\n\n");
  const confidenceValues = pageResults
    .map((result) => result.confidence)
    .filter((confidence) => Number.isFinite(confidence));
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((total, value) => total + value, 0) /
        confidenceValues.length
      : 0.25;

  return {
    confidence: averageConfidence,
    pageCount,
    renderedCount: renderedPages.length,
    textContent: detectedText,
  };
}

export async function extractImportFileContent({
  fileBuffer,
  fileName,
  fileType,
}: {
  fileBuffer: Buffer;
  fileName: string;
  fileType: string;
}): Promise<ImportFileExtraction> {
  if (isPlainTextFile(fileName, fileType)) {
    return {
      confidence: 0.85,
      source: fileName.toLowerCase().endsWith(".csv") ? "csv_text" : "plain_text",
      textContent: fileBuffer.toString("utf8"),
    };
  }

  if (
    fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileName.toLowerCase().endsWith(".xlsx")
  ) {
    return {
      confidence: 0.9,
      source: "xlsx_workbook",
      textContent: "",
    };
  }

  if (isPdfFile(fileName, fileType)) {
    try {
      const textContent = await extractPdfText(fileBuffer);

      if (textContent.trim()) {
        return {
          confidence: 0.78,
          source: "pdf_text",
          textContent,
        };
      }

      const ocrResult = await extractScannedPdfText(fileBuffer);

      return {
        confidence: ocrResult.confidence,
        source: "scanned_pdf_ocr",
        textContent: ocrResult.textContent,
        warning: ocrResult.textContent.trim()
          ? `No embedded PDF text was found, so ${ocrResult.renderedCount} of ${ocrResult.pageCount} page(s) were rendered and OCR scanned.`
          : "No embedded PDF text was found and OCR did not detect readable text.",
      };
    } catch (error) {
      return {
        confidence: 0.1,
        source: "pdf_text_failed",
        textContent: "",
        warning:
          error instanceof Error
            ? `PDF text extraction failed: ${error.message}`
            : "PDF text extraction failed.",
      };
    }
  }

  if (isImageFile(fileName, fileType)) {
    try {
      const result = await extractImageText(fileBuffer);

      return {
        confidence: result.confidence,
        source: "image_ocr",
        textContent: result.textContent,
        warning: result.textContent.trim()
          ? undefined
          : "OCR did not detect readable text in this image.",
      };
    } catch (error) {
      return {
        confidence: 0.1,
        source: "image_ocr_failed",
        textContent: "",
        warning:
          error instanceof Error
            ? `Image OCR failed: ${error.message}`
            : "Image OCR failed.",
      };
    }
  }

  return {
    confidence: 0,
    source: "unsupported",
    textContent: "",
    warning: "This file type is stored, but no automatic extractor is available yet.",
  };
}
