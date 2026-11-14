import { describe, expect, it } from "vitest";
import { applyFilters, filtersToSearch, parseFilters } from "./filters";
import type { EventView } from "./types";

const ev = (over: Partial<EventView>): EventView =>
  ({
    id: "e1", clubId: "c1", clubName: "Cal Hacks", title: "Hack Night", summary: "Build stuff", kind: "event",
    startAt: "2026-11-14T03:00:00Z", endAt: null, deadlineAt: null, sortAt: "2026-11-14T03:00:00Z",
    allDay: false, location: { name: "Soda Hall", address: null, isOnline: false, campusBuilding: "Soda" },
    categories: ["Tech"], tags: ["free food"], cost: { isFree: true, price: null }, freeFood: true,
    ...over,
  }) as EventView;

describe("filters", () => {
  it("round-trips through the URL", () => {
    const f = parseFilters(new URLSearchParams("date=week&cat=tech,food&food=1&q=boba"));
    expect(f.categories).toEqual(["Tech", "Food"]);
    expect(filtersToSearch(f)).toBe("?date=week&cat=tech%2Cfood&food=1&q=boba");
  });
  it("ignores unknown values", () => {
    const f = parseFilters({ date: "someday", cat: "nope", mode: "x" });
    expect(f.date).toBe("all");
    expect(f.categories).toEqual([]);
    expect(f.mode).toBe("any");
  });
  it("filters by category, free food, and text", () => {
    const events = [ev({}), ev({ id: "e2", categories: ["Social"], freeFood: false, title: "Mixer" })];
    expect(applyFilters(events, parseFilters({ cat: "tech" })).map((e) => e.id)).toEqual(["e1"]);
    expect(applyFilters(events, parseFilters({ food: "1" })).map((e) => e.id)).toEqual(["e1"]);
    expect(applyFilters(events, parseFilters({ q: "mixer" })).map((e) => e.id)).toEqual(["e2"]);
  });
  it("filters today in Pacific time", () => {
    const now = new Date("2026-11-13T20:00:00Z"); // Fri Nov 13, noon PT
    const events = [ev({}), ev({ id: "e2", startAt: "2026-11-15T20:00:00Z", sortAt: "2026-11-15T20:00:00Z" })];
    expect(applyFilters(events, parseFilters({ date: "today" }), { now }).map((e) => e.id)).toEqual(["e1"]);
    expect(applyFilters(events, parseFilters({ date: "weekend" }), { now }).map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});
