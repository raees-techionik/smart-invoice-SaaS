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

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-secure-secret"
EMAIL_SETTINGS_SECRET="replace-with-a-secure-secret"
OCR_MAX_PDF_PAGES=5
```

Generate the Prisma client:

```bash
npx prisma generate
```

Apply database migrations:

```bash
npx prisma migrate deploy
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Verification

Before pushing changes, run:

```bash
npm run lint
npm run build
```

## Notes

- Runtime folders such as `.next`, `node_modules`, `tmp`, and `uploads` are not committed.
- Local secrets and database files are ignored through `.gitignore`.
- Frontend components are kept under `src/app/_frontend`.
- Backend/server utilities are kept under `src/app/_backend`.
