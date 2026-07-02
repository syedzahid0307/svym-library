import { describe, it, expect, beforeAll, afterAll } from "vitest";

// These are real integration tests against a real Postgres database -
// deliberately not a fake/mocked db client. A mock can only prove this
// code calls the query-builder methods I expect it to call; it can't
// prove the actual concurrency guarantee (that Postgres's row-level
// locking on the conditional UPDATE and the partial unique index
// genuinely prevent the race under real concurrent load). Faking that
// convincingly would mean re-implementing enough of Postgres's MVCC
// behavior to trust the fake, which is more likely to hide a bug than
// catch one.
//
// Skipped by default. To run:
//   RUN_INTEGRATION_TESTS=1 DATABASE_URL=<a disposable test database> npx vitest run
//
// Do NOT point this at a production database - it inserts and deletes
// real rows.
const shouldRun =
  process.env.RUN_INTEGRATION_TESTS === "1" && !!process.env.DATABASE_URL;

describe.skipIf(!shouldRun)("borrowing domain - concurrency (integration)", () => {
  // These imports are deliberately inside the describe block rather
  // than at module scope, so that when shouldRun is false (the default,
  // e.g. in CI without a real test database configured), this file
  // never even tries to construct a real db client from a fake
  // DATABASE_URL - see lib/config.ts's fail-fast validation, which
  // would otherwise throw at import time in exactly that situation.
  let db: (typeof import("@/database/drizzle"))["db"];
  let books: (typeof import("@/database/schema"))["books"];
  let borrowRecords: (typeof import("@/database/schema"))["borrowRecords"];
  let users: (typeof import("@/database/schema"))["users"];
  let eq: (typeof import("drizzle-orm"))["eq"];
  let borrowBookForUser: (typeof import("@/lib/domain/borrowing"))["borrowBookForUser"];

  let testBookId: string;
  let testUserAId: string;
  let testUserBId: string;

  beforeAll(async () => {
    const drizzleModule = await import("@/database/drizzle");
    const schemaModule = await import("@/database/schema");
    const drizzleOrm = await import("drizzle-orm");
    const borrowingModule = await import("@/lib/domain/borrowing");

    db = drizzleModule.db;
    books = schemaModule.books;
    borrowRecords = schemaModule.borrowRecords;
    users = schemaModule.users;
    eq = drizzleOrm.eq;
    borrowBookForUser = borrowingModule.borrowBookForUser;

    const [book] = await db
      .insert(books)
      .values({
        title: "Concurrency Test Book",
        author: "Test",
        genre: "Test",
        rating: 5,
        coverUrl: "https://example.com/cover.jpg",
        coverColor: "#000000",
        description: "Fixture for concurrency integration test",
        totalCopies: 1,
        availableCopies: 1,
        videoUrl: "https://example.com/video.mp4",
        summary: "Fixture",
        libraryBarcode: `TEST-CONCURRENCY-${Date.now()}`,
      })
      .returning({ id: books.id });
    testBookId = book.id;

    const [userA] = await db
      .insert(users)
      .values({
        fullName: "Test User A",
        email: `test-user-a-${Date.now()}@example.com`,
        staffId: Math.floor(Date.now() % 1000000),
        password: "not-a-real-hash",
        status: "APPROVED",
      })
      .returning({ id: users.id });
    testUserAId = userA.id;

    const [userB] = await db
      .insert(users)
      .values({
        fullName: "Test User B",
        email: `test-user-b-${Date.now()}@example.com`,
        staffId: Math.floor((Date.now() + 1) % 1000000),
        password: "not-a-real-hash",
        status: "APPROVED",
      })
      .returning({ id: users.id });
    testUserBId = userB.id;
  });

  afterAll(async () => {
    if (testBookId) {
      await db.delete(borrowRecords).where(eq(borrowRecords.bookId, testBookId));
      await db.delete(books).where(eq(books.id, testBookId));
    }
    if (testUserAId) await db.delete(users).where(eq(users.id, testUserAId));
    if (testUserBId) await db.delete(users).where(eq(users.id, testUserBId));
  });

  it("only lets one of two concurrent borrows succeed for the last remaining copy", async () => {
    const [resultA, resultB] = await Promise.all([
      borrowBookForUser(db, testUserAId, testBookId),
      borrowBookForUser(db, testUserBId, testBookId),
    ]);

    const successes = [resultA, resultB].filter((r) => r.success);
    const failures = [resultA, resultB].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as { error: string }).error).toBe(
      "Book is not available for borrowing",
    );

    await db.delete(borrowRecords).where(eq(borrowRecords.bookId, testBookId));
    await db.update(books).set({ availableCopies: 1 }).where(eq(books.id, testBookId));
  });

  it("only lets one of two concurrent duplicate-loan attempts by the same user succeed", async () => {
    const [resultA, resultB] = await Promise.all([
      borrowBookForUser(db, testUserAId, testBookId),
      borrowBookForUser(db, testUserAId, testBookId),
    ]);

    const successes = [resultA, resultB].filter((r) => r.success);
    const failures = [resultA, resultB].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as { error: string }).error).toBe(
      "You already have this book borrowed",
    );

    const [current] = await db
      .select({ availableCopies: books.availableCopies })
      .from(books)
      .where(eq(books.id, testBookId));
    expect(current.availableCopies).toBe(0);

    await db.delete(borrowRecords).where(eq(borrowRecords.bookId, testBookId));
    await db.update(books).set({ availableCopies: 1 }).where(eq(books.id, testBookId));
  });
});
