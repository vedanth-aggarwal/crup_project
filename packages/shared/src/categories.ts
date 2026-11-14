/** Fixed category list used for filters (PLAN.md §3). Order is the display order. */
export const CATEGORIES = [
  "Social",
  "Professional/Career",
  "Tech",
  "Academic",
  "Cultural",
  "Arts & Performance",
  "Sports & Rec",
  "Service/Volunteering",
  "Religious",
  "Political/Advocacy",
  "Recruiting/Applications",
  "Food",
  "Greek Life",
  "Wellness",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Display metadata. `hue` feeds the oklch category chip tokens. */
export const CATEGORY_META: Record<Category, { slug: string; hue: number; emoji: string }> = {
  Social: { slug: "social", hue: 330, emoji: "🎉" },
  "Professional/Career": { slug: "career", hue: 230, emoji: "💼" },
  Tech: { slug: "tech", hue: 275, emoji: "💻" },
  Academic: { slug: "academic", hue: 200, emoji: "📚" },
  Cultural: { slug: "cultural", hue: 25, emoji: "🌏" },
  "Arts & Performance": { slug: "arts", hue: 300, emoji: "🎭" },
  "Sports & Rec": { slug: "sports", hue: 145, emoji: "🏀" },
  "Service/Volunteering": { slug: "service", hue: 165, emoji: "🤝" },
  Religious: { slug: "religious", hue: 55, emoji: "🕊️" },
  "Political/Advocacy": { slug: "advocacy", hue: 10, emoji: "📣" },
  "Recruiting/Applications": { slug: "recruiting", hue: 250, emoji: "📝" },
  Food: { slug: "food", hue: 70, emoji: "🍕" },
  "Greek Life": { slug: "greek", hue: 215, emoji: "🏛️" },
  Wellness: { slug: "wellness", hue: 180, emoji: "🧘" },
};

export const categoryFromSlug = (slug: string): Category | undefined =>
  CATEGORIES.find((c) => CATEGORY_META[c].slug === slug);

/** All event times are interpreted in this zone. */
export const CAMPUS_TIMEZONE = "America/Los_Angeles";
