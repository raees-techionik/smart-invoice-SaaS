import { NextResponse } from "next/server";

import { requireUser } from "@/app/_backend/lib/auth/session";
import { buildImportTemplateXlsx, isImportType } from "@/app/_backend/lib/imports";

export const runtime = "nodejs";

type ImportTemplateRouteProps = {
  params: Promise<{
    importType: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ImportTemplateRouteProps,
) {
  await requireUser();
  const { importType } = await params;

  if (!isImportType(importType)) {
    return new NextResponse("Import template not found.", { status: 404 });
  }

  const template = buildImportTemplateXlsx(importType);

  return new NextResponse(new Uint8Array(template.buffer), {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
