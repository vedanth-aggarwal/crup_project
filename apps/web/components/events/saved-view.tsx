"use client";

import { useState } from "react";
import { CalendarDays, LayoutGrid } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventGrid } from "./event-grid";
import { WeekView } from "./week-view";
import { useUserState } from "@/components/auth/user-state";
import type { EventView } from "@/lib/types";

export function SavedView({ events }: { events: EventView[] }) {
  const [view, setView] = useState("list");
  const { bookmarks } = useUserState();
  // Hide un-saved items immediately (optimistic), without waiting for a refetch.
  const shown = events.filter((e) => bookmarks.has(e.id));
  return (
    <div className="space-y-5">
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="list"><LayoutGrid aria-hidden /> List</TabsTrigger>
          <TabsTrigger value="week"><CalendarDays aria-hidden /> Week</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "list" ? <EventGrid events={shown} /> : <WeekView events={shown} />}
    </div>
  );
}
