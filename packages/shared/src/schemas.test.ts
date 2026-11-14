import { describe, expect, it } from "vitest";
import { CATEGORIES, extractionResultSchema } from "./index";

describe("extractionResultSchema", () => {
  it("accepts a recap post with no items", () => {
    const r = extractionResultSchema.safeParse({
      isEventPost: false,
      confidence: 0.95,
      posterAltText: "Group photo of club members",
      items: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects categories outside the fixed list", () => {
    const r = extractionResultSchema.safeParse({
      isEventPost: true,
      confidence: 0.8,
      posterAltText: null,
      items: [
        {
          kind: "event", title: "Boba social", description: null,
          startAt: "2026-11-20T18:00:00-08:00", endAt: null, allDay: false,
          deadlineAt: null, recurrence: null,
          location: { name: "Sproul", address: null, isOnline: false, campusBuilding: null },
          categories: ["Parties"], tags: [], cost: { isFree: true, price: null },
          freeFood: true, links: { rsvp: null, tickets: null, application: null, info: [] },
          summary: "Boba on Sproul.", uncertainFields: [],
          details: { highlights: [], partners: [], speakers: [], audience: null, agenda: [], perks: [], requirements: [], rsvpRequired: null },
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("has 14 categories", () => {
    expect(CATEGORIES).toHaveLength(14);
  });
});
