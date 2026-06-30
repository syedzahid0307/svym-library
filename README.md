# SVYM Library

A library management system built for SVYM (Swami Vivekananda Youth Movement), Mysore — built on top of [Next.js](https://nextjs.org/) and adapted from the open-source [university-library-jsm](https://github.com/adrianhajdin/university-library-jsm) template.

## Features

- **Staff-ID based membership** — sign-up asks for an SVYM staff ID, no photo or document upload required. New accounts stay `PENDING` until an admin verifies the ID and approves the account.
- **QR barcode per book** — every book gets a unique library barcode (`SVYM-XXXXXXXX`) the moment it's added, displayed as a printable QR sticker for physical copies.
- **Manufacturer-barcode lookup when adding books** — scan or type a book's existing ISBN/EAN barcode in the admin "Add Book" form to auto-fill title, author, genre, and cover via the Open Library API.
- **Scan-to-borrow kiosk** (`/scan`) — a member enters their staff ID once, then scans book stickers one after another to borrow them, designed for a shared circulation-desk device.
- **Scan-to-find** (`/scan/find`) — scan a book's sticker to jump straight to its detail page.
- **Admin dashboard** — manage books, review and approve/reject new account requests, change member roles and types, and track borrow records (renew, mark returned, see overdue loans).
- **Overdue email reminders** — a cron-triggered endpoint (`/api/cron/overdue-reminders`) emails members with overdue loans, intended to run daily via Vercel Cron or a similar scheduler.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [PostgreSQL](https://www.postgresql.org/) via [Neon](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/)
- [Auth.js (NextAuth)](https://authjs.dev/) for credentials-based authentication
- [Upstash](https://upstash.com/) (Redis for rate limiting, QStash for workflows)
- [Resend](https://resend.com/) for transactional email
- [ImageKit](https://imagekit.io/) for book cover/media storage
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- `qrcode.react` for generating barcode stickers, `html5-qrcode` for camera-based scanning

## Getting started

```bash
npm install
cp .env.example .env   # then fill in real credentials
npm run dev
```

See `.env.example` for every environment variable the app needs (database, auth, ImageKit, Upstash, Resend, and a `CRON_SECRET` for the overdue-reminder endpoint).

### Database

```bash
npx drizzle-kit generate   # after schema changes
npx drizzle-kit migrate    # apply migrations
```

The `migrations/0002_svym_membership_fields.sql` migration is hand-written (not auto-generated) — review it and back up your database before applying it to existing data.

### First admin account

There's no self-service way to become the first admin — sign up normally, then set that account's `role` to `ADMIN` and `status` to `APPROVED` directly in the database to bootstrap access to `/admin`.

### Deployment

A `vercel.json` is included with a daily cron entry for the overdue-reminder endpoint. If deploying on Vercel, set `CRON_SECRET` in your project's environment variables — Vercel automatically sends it as a bearer token on scheduled requests.

## License

No license has been chosen yet for this project.
