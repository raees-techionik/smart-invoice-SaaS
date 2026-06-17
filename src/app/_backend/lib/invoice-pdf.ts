import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import { parseInvoiceTemplateSettings } from "@/app/_backend/lib/invoice-templates";

type InvoicePdfInput = {
  balanceAmount: unknown;
  business: {
    address: string | null;
    email: string | null;
    logoPath: string | null;
    name: string;
    phone: string | null;
    signaturePath: string | null;
    stampPath: string | null;
    taxNumber: string | null;
  };
  customer: {
    address: string | null;
    businessName: string | null;
    email: string | null;
    name: string;
    phone: string | null;
  } | null;
  discountTotal: unknown;
  dueDate: Date | null;
  grandTotal: unknown;
  invoiceDate: Date;
  invoiceNumber: string;
  items: Array<{
    description: string | null;
    itemName: string;
    lineTotal: unknown;
    quantity: unknown;
    taxAmount: unknown;
    unit: string | null;
    unitPrice: unknown;
  }>;
  notes: string | null;
  paidAmount: unknown;
  subtotal: unknown;
  taxTotal: unknown;
  template?: {
    settings: string | null;
  } | null;
  terms: string | null;
};

type PdfImage = {
  bitsPerComponent: number;
  colorSpace: "/DeviceGray" | "/DeviceRGB" | "/DeviceCMYK";
  data: Buffer;
  filter: "/DCTDecode" | "/FlateDecode";
  height: number;
  name: string;
  width: number;
};

type LoadedAssetImage = Omit<PdfImage, "name">;

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function text(value: string | null | undefined, fallback = "") {
  return (value || fallback)
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function dateText(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function moneyText(value: unknown, currency: string) {
  return `${currency} ${Number(value).toFixed(2)}`;
}

function pdfLine(value: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
}

function hexToRgb(value: string) {
  const hex = value.replace("#", "");
  const fallback = { b: 0.43, g: 0.55, r: 0.06 };

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return fallback;
  }

  return {
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
  };
}

function fillRect(x: number, y: number, width: number, height: number, color: string) {
  const { b, g, r } = hexToRgb(color);

  return `q ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(
    3,
  )} rg ${x} ${y} ${width} ${height} re f Q`;
}

function rule(x1: number, y1: number, x2: number, y2: number) {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function drawImage(image: PdfImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  return `q ${width} 0 0 ${height} ${x} ${y} cm /${image.name} Do Q`;
}

function assetAbsolutePath(assetPath: string | null) {
  if (!assetPath) {
    return null;
  }

  const uploadRoot = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(process.cwd(), assetPath);
  const normalizedRoot = uploadRoot.toLowerCase();
  const normalizedAsset = absolutePath.toLowerCase();

  if (
    normalizedAsset !== normalizedRoot &&
    !normalizedAsset.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

function parseJpegImage(data: Buffer): LoadedAssetImage | null {
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (data[offset] === 0xff) {
      offset += 1;
    }

    const marker = data[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const length = data.readUInt16BE(offset);
    const segmentStart = offset + 2;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      const bitsPerComponent = data[segmentStart];
      const height = data.readUInt16BE(segmentStart + 1);
      const width = data.readUInt16BE(segmentStart + 3);
      const components = data[segmentStart + 5];

      if (![1, 3, 4].includes(components)) {
        return null;
      }

      return {
        bitsPerComponent,
        colorSpace:
          components === 1
            ? "/DeviceGray"
            : components === 4
              ? "/DeviceCMYK"
              : "/DeviceRGB",
        data,
        filter: "/DCTDecode",
        height,
        width,
      };
    }

    offset += length;
  }

  return null;
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
}

function unfilterPngRows(data: Buffer, width: number, height: number, channels: number) {
  const rowLength = width * channels;
  const rows: Buffer[] = [];
  let offset = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filter = data[offset];
    const source = data.subarray(offset + 1, offset + 1 + rowLength);
    const row = Buffer.alloc(rowLength);
    const previous = rows[rowIndex - 1];

    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const up = previous ? previous[index] : 0;
      const upLeft = previous && index >= channels ? previous[index - channels] : 0;
      const current = source[index];

      if (filter === 0) {
        row[index] = current;
      } else if (filter === 1) {
        row[index] = (current + left) & 0xff;
      } else if (filter === 2) {
        row[index] = (current + up) & 0xff;
      } else if (filter === 3) {
        row[index] = (current + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        row[index] = (current + paethPredictor(left, up, upLeft)) & 0xff;
      } else {
        throw new Error("Unsupported PNG filter.");
      }
    }

    rows.push(row);
    offset += rowLength + 1;
  }

  return rows;
}

function stripAlphaRows(rows: Buffer[], channels: number, outputChannels: number) {
  if (channels === outputChannels) {
    return Buffer.concat(rows);
  }

  return Buffer.concat(
    rows.map((row) => {
      const output = Buffer.alloc((row.length / channels) * outputChannels);
      let outputIndex = 0;

      for (let index = 0; index < row.length; index += channels) {
        for (let channel = 0; channel < outputChannels; channel += 1) {
          output[outputIndex] = row[index + channel];
          outputIndex += 1;
        }
      }

      return output;
    }),
  );
}

function parsePngImage(data: Buffer): LoadedAssetImage | null {
  if (!data.subarray(0, 8).equals(pngSignature)) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkData = data.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlace = chunkData[12];
    } else if (type === "IDAT") {
      idatChunks.push(chunkData);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || interlace !== 0 || idatChunks.length === 0) {
    return null;
  }

  const channelsByColorType = new Map([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4],
  ]);
  const channels = channelsByColorType.get(colorType);

  if (!channels) {
    return null;
  }

  const rows = unfilterPngRows(inflateSync(Buffer.concat(idatChunks)), width, height, channels);
  const outputChannels = colorType === 0 || colorType === 4 ? 1 : 3;
  const imageBytes = stripAlphaRows(rows, channels, outputChannels);

  return {
    bitsPerComponent: 8,
    colorSpace: outputChannels === 1 ? "/DeviceGray" : "/DeviceRGB",
    data: deflateSync(imageBytes),
    filter: "/FlateDecode",
    height,
    width,
  };
}

function loadAssetImage(assetPath: string | null, name: string): PdfImage | null {
  const absolutePath = assetAbsolutePath(assetPath);

  if (!absolutePath || !existsSync(absolutePath)) {
    return null;
  }

  const file = readFileSync(absolutePath);
  const image = parseJpegImage(file) ?? parsePngImage(file);

  return image ? { ...image, name } : null;
}

function buildPdf(content: string, images: PdfImage[]) {
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = Buffer.byteLength("%PDF-1.4\n", "ascii");
  const imageStartObjectId = 6;
  const imageResources = images
    .map((image, index) => `/${image.name} ${imageStartObjectId + index} 0 R`)
    .join(" ");
  const xObjectResources = imageResources
    ? `/XObject << ${imageResources} >>`
    : "";

  function addObject(body: string | Buffer) {
    const objectId = parts.length + 1;
    const object = Buffer.concat([
      Buffer.from(`${objectId} 0 obj\n`, "ascii"),
      typeof body === "string" ? Buffer.from(body, "ascii") : body,
      Buffer.from("\nendobj\n", "ascii"),
    ]);

    offsets.push(length);
    parts.push(object);
    length += object.length;

    return objectId;
  }

  function streamObject(dictionary: string, stream: Buffer) {
    addObject(
      Buffer.concat([
        Buffer.from(`${dictionary}\nstream\n`, "ascii"),
        stream,
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> ${xObjectResources} >> /Contents 5 0 R >>`,
  );
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  streamObject(
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>`,
    Buffer.from(content, "ascii"),
  );

  for (const image of images) {
    streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent} /Filter ${image.filter} /Length ${image.data.length} >>`,
      image.data,
    );
  }

  const xrefOffset =
    Buffer.byteLength("%PDF-1.4\n", "ascii") +
    parts.reduce((total, part) => total + part.length, 0);
  const xref = [
    "xref",
    `0 ${parts.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${parts.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  return Buffer.concat([
    Buffer.from("%PDF-1.4\n", "ascii"),
    ...parts,
    Buffer.from(`${xref}\n`, "ascii"),
  ]);
}

export function generateInvoicePdf(invoice: InvoicePdfInput, currency: string) {
  const settings = parseInvoiceTemplateSettings(invoice.template?.settings);
  const shouldShowLogo =
    settings.showLogo && settings.logoPlacement !== "hidden";
  const shouldShowSignature =
    settings.showSignature && settings.signaturePlacement !== "hidden";
  const shouldShowStamp =
    settings.showStamp && settings.stampPlacement !== "hidden";
  const logo = shouldShowLogo
    ? loadAssetImage(invoice.business.logoPath, "Logo")
    : null;
  const signature = shouldShowSignature
    ? loadAssetImage(invoice.business.signaturePath, "Signature")
    : null;
  const stamp = shouldShowStamp
    ? loadAssetImage(invoice.business.stampPath, "Stamp")
    : null;
  const images = [logo, signature, stamp].filter(
    (image): image is PdfImage => Boolean(image),
  );
  const content: string[] = ["0.8 w"];
  const hasLeftLogo = Boolean(logo && settings.logoPlacement === "left");
  const hasRightLogo = Boolean(logo && settings.logoPlacement === "right");
  const headerBusinessX = hasLeftLogo ? 148 : 42;
  const lineStep = settings.density === "compact" ? 15 : 18;
  let y = 760;

  content.push(fillRect(42, 782, 528, 5, settings.accentColor));

  if (logo && settings.logoPlacement === "left") {
    content.push(drawImage(logo, 42, 712, 90, 58));
  }

  if (logo && settings.logoPlacement === "right") {
    content.push(drawImage(logo, 480, 712, 90, 58));
  }

  content.push(pdfLine(text(invoice.business.name, "Business"), headerBusinessX, y, 20));
  content.push(pdfLine("Invoice", hasRightLogo ? 394 : 456, y, 28));
  y -= 22;
  content.push(pdfLine(text(invoice.business.address, "Address not set"), headerBusinessX, y));
  content.push(pdfLine(`# ${text(invoice.invoiceNumber)}`, hasRightLogo ? 394 : 456, y, 11));
  y -= 16;
  content.push(
    pdfLine(
      text(
        [invoice.business.phone, invoice.business.email].filter(Boolean).join(" / "),
      ),
      headerBusinessX,
      y,
    ),
  );
  content.push(pdfLine(`Invoice date: ${dateText(invoice.invoiceDate)}`, hasRightLogo ? 394 : 456, y));
  y -= 16;
  content.push(pdfLine(`Due date: ${dateText(invoice.dueDate)}`, hasRightLogo ? 394 : 456, y));
  if (settings.showBusinessTaxNumber && invoice.business.taxNumber) {
    y -= 16;
    content.push(pdfLine(`Tax no: ${text(invoice.business.taxNumber)}`, headerBusinessX, y));
  }
  y -= 26;
  content.push(rule(42, y, 570, y));

  y -= 28;
  content.push(pdfLine("Bill to", 42, y, 12));
  y -= 17;
  content.push(
    pdfLine(
      text(invoice.customer?.businessName || invoice.customer?.name, "Customer"),
      42,
      y,
      11,
    ),
  );
  y -= 15;
  content.push(pdfLine(text(invoice.customer?.address, "Address not set"), 42, y));
  if (settings.showCustomerContacts) {
    y -= 15;
    content.push(
      pdfLine(
        text([invoice.customer?.phone, invoice.customer?.email].filter(Boolean).join(" / ")),
        42,
        y,
      ),
    );
  }

  y -= 36;
  content.push(rule(42, y + 18, 570, y + 18));
  content.push(pdfLine("Item", 42, y, 10));
  content.push(pdfLine("Qty", 300, y, 10));
  content.push(pdfLine("Price", 350, y, 10));
  content.push(pdfLine("Tax", 430, y, 10));
  content.push(pdfLine("Total", 512, y, 10));
  y -= 10;
  content.push(rule(42, y, 570, y));
  y -= 18;

  for (const item of invoice.items.slice(0, 20)) {
    content.push(pdfLine(truncate(text(item.itemName, "Line item"), 44), 42, y));
    content.push(pdfLine(Number(item.quantity).toFixed(2), 300, y));
    content.push(pdfLine(moneyText(item.unitPrice, currency), 350, y));
    content.push(pdfLine(moneyText(item.taxAmount, currency), 430, y));
    content.push(pdfLine(moneyText(item.lineTotal, currency), 512, y));
    if (settings.showItemDescriptions && (item.description || item.unit)) {
      y -= 11;
      content.push(
        pdfLine(
          truncate(text(item.description || item.unit), 58),
          42,
          y,
          8,
        ),
      );
    }
    y -= lineStep;
  }

  if (invoice.items.length > 20) {
    content.push(pdfLine(`+ ${invoice.items.length - 20} more line items`, 42, y));
    y -= 18;
  }

  y = Math.min(y - 10, 280);
  content.push(rule(340, y, 570, y));
  y -= 18;

  const totals: Array<[string, unknown]> = [
    ["Subtotal", invoice.subtotal],
    ["Discount", invoice.discountTotal],
    ["Tax", invoice.taxTotal],
    ["Grand total", invoice.grandTotal],
    ["Paid", invoice.paidAmount],
    ["Balance due", invoice.balanceAmount],
  ];

  for (const [label, amount] of totals) {
    content.push(pdfLine(label, 350, y, label === "Balance due" ? 12 : 10));
    content.push(
      pdfLine(
        moneyText(amount, currency),
        470,
        y,
        label === "Balance due" ? 12 : 10,
      ),
    );
    y -= 18;
  }

  y -= 10;

  if (settings.paymentInstructions) {
    content.push(pdfLine("Payment instructions", 42, y, 11));
    y -= 15;
    content.push(pdfLine(truncate(text(settings.paymentInstructions), 88), 42, y));
    y -= 24;
  }

  if (invoice.terms) {
    content.push(pdfLine("Terms", 42, y, 11));
    y -= 15;
    content.push(pdfLine(truncate(text(invoice.terms), 88), 42, y));
    y -= 24;
  }

  if (invoice.notes) {
    content.push(pdfLine("Notes", 42, y, 11));
    y -= 15;
    content.push(pdfLine(truncate(text(invoice.notes), 88), 42, y));
    y -= 24;
  }

  if (settings.footerText) {
    content.push(pdfLine("Footer", 42, y, 11));
    y -= 15;
    content.push(pdfLine(truncate(text(settings.footerText), 88), 42, y));
  }

  if (signature) {
    const x = settings.signaturePlacement === "right" ? 400 : 42;

    content.push(drawImage(signature, x, 72, 130, 54));
    content.push(rule(x, 66, x + 130, 66));
    content.push(pdfLine(text(settings.signatureLabel), x, 52, 9));
  }

  if (stamp) {
    const x =
      settings.stampPlacement === "right"
        ? 488
        : settings.signaturePlacement === "right"
          ? 300
          : 214;

    content.push(drawImage(stamp, x, 64, 82, 82));
    content.push(pdfLine("Stamp", x + 22, 52, 9));
  }

  return buildPdf(content.join("\n"), images);
}
