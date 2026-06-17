import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { prisma } from "@/app/_backend/lib/db/prisma";
import { generateInvoicePdf } from "@/app/_backend/lib/invoice-pdf";

export const runtime = "nodejs";

type TemplatePreviewRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function previewFilename(templateName: string) {
  const safeName = templateName
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-|-$/g, "");

  return `${safeName || "invoice-template"}-preview.pdf`;
}

export async function GET(_request: Request, { params }: TemplatePreviewRouteProps) {
  const user = await requireUser();
  const { id } = await params;
  const template = await prisma.invoiceTemplate.findFirst({
    where: {
      businessId: user.businessId,
      id,
    },
  });

  if (!template) {
    return new NextResponse("Template not found.", { status: 404 });
  }

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 7);

  const pdf = generateInvoicePdf(
    {
      balanceAmount: "47250",
      business: user.business,
      customer: {
        address: "Customer business address",
        businessName: "Preview Customer Pvt Ltd",
        email: "customer@example.com",
        name: "Preview Customer",
        phone: "+92 300 0000000",
      },
      discountTotal: "500",
      dueDate,
      grandTotal: "47250",
      invoiceDate,
      invoiceNumber: "PREVIEW-00001",
      items: [
        {
          description: "Premium service package",
          itemName: "Consulting service",
          lineTotal: "31500",
          quantity: "3",
          taxAmount: "1500",
          unit: "hour",
          unitPrice: "10000",
        },
        {
          description: "Product line sample",
          itemName: "Retail product",
          lineTotal: "15750",
          quantity: "5",
          taxAmount: "750",
          unit: "pcs",
          unitPrice: "3000",
        },
      ],
      notes: "This is a sample preview invoice.",
      paidAmount: "0",
      subtotal: "45000",
      taxTotal: "2250",
      template,
      terms: "Payment due within 7 days.",
    },
    user.business.currency,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="${previewFilename(
        template.name,
      )}"`,
      "Content-Length": String(pdf.length),
      "Content-Type": "application/pdf",
    },
  });
}
