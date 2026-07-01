# Contributing to SVYM Library

Thanks for considering a contribution. This project runs on Next.js (App Router), TypeScript, Drizzle ORM, and Neon Postgres.

## Setup

```bash
npm install
cp .env.example .env   # fill in real credentials - see .env.example for what each one is for
npm run dev
```

You'll need accounts for Neon (Postgres), Upstash (Redis + QStash), ImageKit, and Resend to run the app with all features working. The app will refuse to start with a clear error if a required env var is missing (`lib/config.ts`).

## Before opening a PR

Run these locally - they're also enforced in CI (`.github/workflows/ci.yml`), so a PR won't merge if any of them fail:

```bash
npx eslint .
npx tsc --noEmit
npm run build
```

## Database changes

This project uses hand-reviewed SQL migrations under `migrations/`, not blind `drizzle-kit generate` output - schema changes should be reasoned about deliberately, especially anything adding a constraint (unique index, CHECK, foreign key) that existing data could already violate.

If your change touches `database/schema.ts`:

1. Write the migration by hand (or generate one with `npx drizzle-kit generate` and review it carefully).
2. If the migration adds a constraint, include a comment with a pre-flight query someone can run to check for existing rows that would violate it before applying the migration - see `migrations/0003_data_integrity_hardening.sql` for an example of this pattern.
3. Note in your PR description whether the migration is safe to run against a database with existing data, or whether it needs manual data cleanup first.

## Code conventions

- Server Actions live in `lib/actions/` (member-facing) and `lib/admin/actions/` (admin-only). Every admin action must call `requireAdmin()` from `lib/admin/guard.ts` as its first line - page-level layout checks alone don't protect the underlying action, since Next.js exposes each `"use server"` function as its own callable endpoint regardless of which page imports it.
- Due/return date arithmetic should go through the helpers in `lib/date.ts`, not bare `dayjs()` calls - see the comment at the top of that file for why.
- Avoid `any` and `@ts-ignore` - if a third-party library's types are genuinely wrong or missing, prefer a narrow, explicit type assertion with a comment explaining why, over silencing the checker.
- Prefer atomic, conditional SQL updates (`UPDATE ... WHERE <condition>`) over read-then-write patterns for anything touching a shared counter (like `availableCopies`) - a read-then-write is a race condition waiting to happen under concurrent requests.

## Reporting a security issue

Please don't open a public issue for a security vulnerability. Contact the maintainer directly instead.

## Questions

Open an issue for anything that isn't covered here.
