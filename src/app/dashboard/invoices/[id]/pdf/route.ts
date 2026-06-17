import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { generateInvoicePdf } from "@/app/_backend/lib/invoice-pdf";

export const runtime = "nodejs";

type InvoicePdfRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function pdfFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-|-$/g, "");

  return `${safeInvoiceNumber || "invoice"}.pdf`;
}

export async function GET(request: Request, { params }: InvoicePdfRouteProps) {
  const user = await requireUser();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    include: {
      business: true,
      customer: true,
      items: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      template: true,
    },
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!invoice) {
    return new NextResponse("Invoice not found.", { status: 404 });
  }

  const url = new URL(request.url);
  const shouldDownload = url.searchParams.get("download") === "1";
  const pdf = generateInvoicePdf(invoice, user.business.currency);
  const disposition = shouldDownload ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `${disposition}; filename="${pdfFilename(
        invoice.invoiceNumber,
      )}"`,
      "Content-Length": String(pdf.length),
      "Content-Type": "application/pdf",
    },
  });
}
