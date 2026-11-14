import { describe, expect, it } from "vitest";
import { countdown, formatWhen, ptDayKey, startOfPtDay, timeGroup, timeRange } from "./dates";

describe("dates (Pacific time)", () => {
  it("formats a same-meridiem range compactly", () => {
    expect(timeRange(new Date("2026-11-14T03:00:00Z"), new Date("2026-11-14T05:00:00Z"))).toBe("7–9 PM");
  });
  it("formats a cross-meridiem range in full", () => {
    expect(timeRange(new Date("2026-11-14T19:00:00Z"), new Date("2026-11-14T21:30:00Z"))).toBe("11 AM–1:30 PM");
  });
  it("formats when with weekday and date", () => {
    expect(formatWhen("2026-11-14T03:00:00Z", "2026-11-14T05:00:00Z", false)).toBe("Fri, Nov 13 · 7–9 PM");
  });
  it("uses the Pacific calendar day, not UTC", () => {
    expect(ptDayKey(new Date("2026-11-14T05:00:00Z"))).toBe("2026-11-13");
  });
  it("finds the start of a PST day", () => {
    expect(startOfPtDay(new Date("2026-11-14T20:00:00Z")).toISOString()).toBe("2026-11-14T08:00:00.000Z");
  });
  it("finds the start of a PDT day", () => {
    expect(startOfPtDay(new Date("2026-07-04T20:00:00Z")).toISOString()).toBe("2026-07-04T07:00:00.000Z");
  });
  it("groups a live event as now", () => {
    const now = new Date("2026-11-14T03:30:00Z");
    expect(timeGroup("2026-11-14T03:00:00Z", "2026-11-14T05:00:00Z", now)).toBe("now");
  });
  it("labels deadline urgency", () => {
    const now = new Date("2026-11-14T00:00:00Z");
    expect(countdown("2026-11-14T18:00:00Z", now)).toEqual({ label: "Closes in 18h", level: "today" });
    expect(countdown("2026-11-13T00:00:00Z", now).level).toBe("closed");
  });
});

import { isoToPtLocal, ptLocalToIso } from "./dates";
describe("datetime-local round trip", () => {
  it("handles PST and PDT", () => {
    expect(ptLocalToIso("2026-11-14T19:00")).toBe("2026-11-15T03:00:00.000Z");
    expect(ptLocalToIso("2026-07-04T19:00")).toBe("2026-07-05T02:00:00.000Z");
    expect(isoToPtLocal("2026-11-15T03:00:00.000Z")).toBe("2026-11-14T19:00");
  });
});
