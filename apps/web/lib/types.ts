import type { Category, ClubEvent, Club } from "@clubo/shared";

/** UI-safe event: ISO date strings (cache + client serializable), no embedding. */
export type EventView = Omit<
  ClubEvent,
  "startAt" | "endAt" | "deadlineAt" | "sortAt" | "createdAt" | "updatedAt"
> & {
  id: string;
  startAt: string | null;
  endAt: string | null;
  deadlineAt: string | null;
  sortAt: string;
  createdAt: string;
  updatedAt: string;
  clubHandle?: string;
  clubAvatarUrl?: string | null;
};

export type ClubView = Omit<Club, "lastScrapedAt" | "lastPostAt"> & {
  id: string;
  lastScrapedAt: string | null;
  lastPostAt: string | null;
  upcomingCount?: number;
};

export type UserView = {
  uid: string;
  email: string | null;
  name: string | null;
  followedClubs: string[];
  followedCategories: Category[];
  notificationPrefs: {
    reminders: boolean;
    reminderLeadHours: number;
    deadlines: boolean;
    weeklyDigest: boolean;
    newFromFollowed: boolean;
  };
  bookmarkIds: string[];
};
