# Smart Invoice SaaS

Smart Invoice SaaS is a Next.js business invoicing application for managing customers, products, invoices, payments, expenses, inventory, imports, exports, reports, templates, and business settings from one dashboard.

## Features

- Business setup and profile management
- Customer and product management
- Invoice creation, PDF generation, sending workflow, and template previews
- Payments, refunds, expenses, and inventory tracking
- POS workflow for quick sales
- Dashboard reports and Excel exports
- CSV, Excel, PDF, and OCR-assisted import workflow
- Downloadable Excel import templates
- OCR review/source workflow with extracted field review
- Invoice PDF to Excel export support

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite database for local development
- Tesseract.js and PDF.js for OCR/PDF extraction
- XLSX for Excel import/export
- Node.js 22.13 or newer
- pnpm 11.7

## Project Structure

```text
prisma/
  migrations/
  schema.prisma

public/

src/
  app/
    _frontend/
      components/
        dashboard/
        forms/
        imports/
        invoices/
        reports/
        settings/
        tables/
        ui/
    _backend/
      lib/
        auth/
        db/
        excel/
        ocr/
        pdf/
        smart-engine/
        validations/
    dashboard/
    login/
    setup/
    actions.ts
    globals.css
    layout.tsx
    page.tsx

tests/
```

## Setup

Use Node.js 22.13 or newer. The OCR/PDF stack depends on packages that do not
support older Node 20 releases.

Install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
```

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
OCR_MAX_PDF_PAGES=5
```

You can copy `.env.example` as a starting point.

Generate the Prisma client:

```bash
pnpm prisma:generate
```

Apply database migrations:

```bash
pnpm db:migrate
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm verify
```

## Verification

Before pushing changes, run:

```bash
pnpm verify
```

## Notes

- Runtime folders such as `.next`, `node_modules`, `tmp`, and `uploads` are not committed.
- Local secrets and database files are ignored through `.gitignore`.
- Frontend components are kept under `src/app/_frontend`.
- Backend/server utilities are kept under `src/app/_backend`.
