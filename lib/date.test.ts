import { describe, it, expect, vi, afterEach } from "vitest";

describe("lib/date.ts - library timezone helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("computes 'today' in the configured library timezone, not the server process's ambient timezone", async () => {
    // This is the exact bug found and fixed in this project: a server
    // process running in UTC (Vercel's default) computing "today" via
    // bare dayjs() would be a full calendar day behind IST for a ~5.5
    // hour window every night. Simulate that server-local-UTC condition
    // explicitly rather than relying on whatever timezone this test
    // happens to run in.
    process.env.TZ = "UTC";
    vi.stubEnv("LIBRARY_TIMEZONE", "Asia/Kolkata");
    vi.resetModules();

    const { libraryToday } = await import("./date");

    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    const timezone = (await import("dayjs/plugin/timezone")).default;
    dayjs.extend(utc);
    dayjs.extend(timezone);

    // 2026-07-01 18:45 UTC = 2026-07-02 00:15 IST - past midnight in IST,
    // not yet past midnight in UTC. A server naively using UTC "today"
    // would say 2026-07-01; the library-timezone-aware helper must say
    // 2026-07-02.
    const fixedInstant = dayjs.utc("2026-07-01T18:45:00Z").valueOf();
    vi.useFakeTimers();
    vi.setSystemTime(fixedInstant);

    expect(libraryToday()).toBe("2026-07-02");

    vi.useRealTimers();
  });

  it("defaults to Asia/Kolkata when LIBRARY_TIMEZONE isn't set", async () => {
    vi.stubEnv("LIBRARY_TIMEZONE", "");
    vi.resetModules();

    const { LIBRARY_TIMEZONE } = await import("./date");

    expect(LIBRARY_TIMEZONE).toBe("Asia/Kolkata");
  });

  it("libraryDueDate adds the requested number of days in the library timezone", async () => {
    vi.stubEnv("LIBRARY_TIMEZONE", "Asia/Kolkata");
    vi.resetModules();

    const { libraryDueDate } = await import("./date");
    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    const fixedInstant = dayjs.utc("2026-07-01T10:00:00Z").valueOf();
    vi.useFakeTimers();
    vi.setSystemTime(fixedInstant);

    // 2026-07-01 10:00 UTC = 2026-07-01 15:30 IST, +7 days = 2026-07-08
    expect(libraryDueDate(7)).toBe("2026-07-08");

    vi.useRealTimers();
  });

  it("isBeforeLibraryToday correctly flags an overdue date", async () => {
    vi.stubEnv("LIBRARY_TIMEZONE", "Asia/Kolkata");
    vi.resetModules();

    const { isBeforeLibraryToday } = await import("./date");
    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    const fixedInstant = dayjs.utc("2026-07-10T10:00:00Z").valueOf();
    vi.useFakeTimers();
    vi.setSystemTime(fixedInstant);

    expect(isBeforeLibraryToday("2026-07-01")).toBe(true);
    expect(isBeforeLibraryToday("2026-07-20")).toBe(false);

    vi.useRealTimers();
  });
});
