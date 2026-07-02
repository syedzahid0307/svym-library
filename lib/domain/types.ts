import { db } from "@/database/drizzle";

// The domain layer (lib/domain/*) takes this as a parameter rather than
// importing the `db` singleton directly, the way every Server Action in
// this app previously did. That's the actual point of this file: a
// function that hard-imports its database client can only ever be
// called inside a real request against a real database - there's no
// seam to substitute a test double, so unit-testing business logic
// (e.g. "does borrowing the last copy correctly reject a second
// concurrent borrow") means either mocking a module import or hitting a
// real Postgres instance for every test. Passing db as a parameter
// fixes that for free, at zero runtime cost - callers in production
// just pass the real `db` singleton.
export type Database = typeof db;
