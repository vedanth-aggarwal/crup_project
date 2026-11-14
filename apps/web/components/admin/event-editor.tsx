"use client";

import { forwardRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@clubo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "./club-forms";
import { saveEvent } from "@/app/admin/actions";
import { isoToPtLocal, ptLocalToIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

type Form = {
  title: string;
  summary: string;
  description: string;
  kind: "event" | "deadline";
  startAt: string;
  endAt: string;
  allDay: boolean;
  deadlineAt: string;
  recurrence: string;
  locName: string;
  locAddress: string;
  isOnline: boolean;
  categories: Category[];
  tags: string;
  isFree: "yes" | "no" | "unknown";
  price: string;
  freeFood: boolean;
  rsvp: string;
  tickets: string;
  application: string;
  info: string;
  status: "published" | "needs_review" | "hidden";
  highlights: string;
  partners: string;
  audience: string;
  perks: string;
  requirements: string;
  rsvpRequired: boolean;
  /** Kept as extracted (not edited in the form). */
  agenda: EventView["details"]["agenda"];
  speakers: EventView["details"]["speakers"];
};

const toForm = (e: EventView): Form => ({
  title: e.title,
  summary: e.summary,
  description: e.description ?? "",
  kind: e.kind,
  startAt: isoToPtLocal(e.startAt),
  endAt: isoToPtLocal(e.endAt),
  allDay: e.allDay,
  deadlineAt: isoToPtLocal(e.deadlineAt),
  recurrence: e.recurrence ?? "",
  locName: e.location?.name ?? "",
  locAddress: e.location?.address ?? "",
  isOnline: e.location?.isOnline ?? false,
  categories: e.categories,
  tags: e.tags.join(", "),
  isFree: e.cost?.isFree === true ? "yes" : e.cost?.isFree === false ? "no" : "unknown",
  price: e.cost?.price ?? "",
  freeFood: e.freeFood,
  rsvp: e.links?.rsvp ?? "",
  tickets: e.links?.tickets ?? "",
  application: e.links?.application ?? "",
  info: (e.links?.info ?? []).join("\n"),
  status: e.status,
  highlights: e.details.highlights.join("\n"),
  partners: e.details.partners.join(", "),
  audience: e.details.audience ?? "",
  perks: e.details.perks.join("\n"),
  requirements: e.details.requirements.join("\n"),
  rsvpRequired: e.details.rsvpRequired === true,
  agenda: e.details.agenda,
  speakers: e.details.speakers,
});

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const nz = (s: string) => (s.trim() ? s.trim() : null);

export function formToPayload(f: Form, status?: Form["status"]) {
  return {
    title: f.title,
    summary: f.summary,
    description: f.description,
    kind: f.kind,
    startAt: f.kind === "event" ? ptLocalToIso(f.startAt) : null,
    endAt: f.kind === "event" ? ptLocalToIso(f.endAt) : null,
    allDay: f.allDay,
    deadlineAt: ptLocalToIso(f.deadlineAt),
    recurrence: nz(f.recurrence),
    location: { name: nz(f.locName), address: nz(f.locAddress), isOnline: f.isOnline, campusBuilding: null },
    categories: f.categories,
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    cost: { isFree: f.isFree === "unknown" ? null : f.isFree === "yes", price: nz(f.price) },
    freeFood: f.freeFood,
    links: {
      rsvp: nz(f.rsvp),
      tickets: nz(f.tickets),
      application: nz(f.application),
      info: f.info.split(/\s+/).map((s) => s.trim()).filter(Boolean),
    },
    status: status ?? f.status,
    details: {
      highlights: lines(f.highlights),
      partners: f.partners.split(",").map((x) => x.trim()).filter(Boolean),
      speakers: f.speakers,
      audience: nz(f.audience),
      agenda: f.agenda,
      perks: lines(f.perks),
      requirements: lines(f.requirements),
      rsvpRequired: f.rsvpRequired ? true : null,
    },
  };
}

/** Field wrapper: highlights fields the LLM flagged as uncertain. */
function F({ label, id, uncertain, children, className }: { label: string; id: string; uncertain?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className={cn("text-xs", uncertain && "text-warning")}>
        {label}
        {uncertain && <span className="ml-1 rounded bg-warning/20 px-1 text-[10px] font-semibold uppercase">check</span>}
      </Label>
      <div className={cn(uncertain && "rounded-md ring-2 ring-warning/60")}>{children}</div>
    </div>
  );
}

/** Remount with `key={event.id}` to load a different event. */
export const EventEditor = forwardRef<HTMLInputElement, { event: EventView; onSaved?: () => void; footer?: React.ReactNode }>(
  function EventEditor({ event, onSaved, footer }, titleRef) {
    const [f, setF] = useState<Form>(() => toForm(event));
    const [pending, start] = useTransition();
    const u = new Set(event.uncertainFields);
    const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

    const save = (status?: Form["status"]) =>
      start(async () => {
        const r = await saveEvent(event.id, formToPayload(f, status));
        if (!r.ok) return void toast.error(r.error);
        toast.success(status === "published" ? "Saved and published" : "Saved");
        onSaved?.();
      });

    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <F label="Title" id="title" uncertain={u.has("title")}>
          <Input id="title" ref={titleRef} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </F>
        <F label="Card summary (1–2 sentences)" id="summary" uncertain={u.has("summary")}>
          <Textarea id="summary" rows={2} value={f.summary} onChange={(e) => set("summary", e.target.value)} />
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Kind" id="kind">
            <Select value={f.kind} onValueChange={(v) => set("kind", v as Form["kind"])}>
              <SelectTrigger id="kind" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Status" id="status">
            <Select value={f.status} onValueChange={(v) => set("status", v as Form["status"])}>
              <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        {f.kind === "event" ? (
          <div className="grid grid-cols-2 gap-3">
            <F label="Starts (Pacific)" id="startAt" uncertain={u.has("startAt")}>
              <Input id="startAt" type="datetime-local" value={f.startAt} onChange={(e) => set("startAt", e.target.value)} />
            </F>
            <F label="Ends" id="endAt" uncertain={u.has("endAt")}>
              <Input id="endAt" type="datetime-local" value={f.endAt} onChange={(e) => set("endAt", e.target.value)} />
            </F>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <Switch checked={f.allDay} onCheckedChange={(v) => set("allDay", v)} /> All day
            </label>
          </div>
        ) : (
          <F label="Deadline (Pacific)" id="deadlineAt" uncertain={u.has("deadlineAt")}>
            <Input id="deadlineAt" type="datetime-local" value={f.deadlineAt} onChange={(e) => set("deadlineAt", e.target.value)} />
          </F>
        )}
        <div className="grid grid-cols-2 gap-3">
          <F label="Location" id="locName" uncertain={u.has("location")}>
            <Input id="locName" value={f.locName} onChange={(e) => set("locName", e.target.value)} placeholder="Dwinelle 155" />
          </F>
          <F label="Address" id="locAddress">
            <Input id="locAddress" value={f.locAddress} onChange={(e) => set("locAddress", e.target.value)} />
          </F>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.isOnline} onCheckedChange={(v) => set("isOnline", v)} /> Online
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={f.freeFood} onCheckedChange={(v) => set("freeFood", v)} /> Free food
          </label>
        </div>
        <F label="Repeats" id="recurrence" uncertain={u.has("recurrence")}>
          <Input id="recurrence" value={f.recurrence} onChange={(e) => set("recurrence", e.target.value)} placeholder="Every Tuesday" />
        </F>
        <F label="Categories" id="cats" uncertain={u.has("categories")}>
          <CategoryPicker value={f.categories} onChange={(v) => set("categories", v)} />
        </F>
        <F label="Tags (comma separated)" id="tags">
          <Input id="tags" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Free entry?" id="isFree" uncertain={u.has("cost")}>
            <Select value={f.isFree} onValueChange={(v) => set("isFree", v as Form["isFree"])}>
              <SelectTrigger id="isFree" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="yes">Free</SelectItem>
                <SelectItem value="no">Paid</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Price" id="price">
            <Input id="price" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="$5 / $10 at door" />
          </F>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <F label="RSVP link" id="rsvp" uncertain={u.has("links")}>
            <Input id="rsvp" type="url" value={f.rsvp} onChange={(e) => set("rsvp", e.target.value)} />
          </F>
          <F label="Tickets link" id="tickets">
            <Input id="tickets" type="url" value={f.tickets} onChange={(e) => set("tickets", e.target.value)} />
          </F>
          <F label="Application link" id="application">
            <Input id="application" type="url" value={f.application} onChange={(e) => set("application", e.target.value)} />
          </F>
        </div>
        <F label="Other links (one per line)" id="info">
          <Textarea id="info" rows={2} value={f.info} onChange={(e) => set("info", e.target.value)} className="font-mono text-xs" />
        </F>
        <F label="Highlights (one per line)" id="highlights">
          <Textarea id="highlights" rows={3} value={f.highlights} onChange={(e) => set("highlights", e.target.value)} />
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Companies / partners (comma separated)" id="partners">
            <Input id="partners" value={f.partners} onChange={(e) => set("partners", e.target.value)} placeholder="Uber, SWE @ Berkeley" />
          </F>
          <F label="Who it's for" id="audience">
            <Input id="audience" value={f.audience} onChange={(e) => set("audience", e.target.value)} placeholder="All majors" />
          </F>
          <F label="Perks (one per line)" id="perks">
            <Textarea id="perks" rows={2} value={f.perks} onChange={(e) => set("perks", e.target.value)} />
          </F>
          <F label="Before you go (one per line)" id="requirements">
            <Textarea id="requirements" rows={2} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </F>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Switch checked={f.rsvpRequired} onCheckedChange={(v) => set("rsvpRequired", v)} /> RSVP required
          </label>
        </div>
        {(f.agenda.length > 0 || f.speakers.length > 0) && (
          <p className="text-xs text-muted-foreground">
            Also extracted: {f.agenda.length} agenda item(s), {f.speakers.length} speaker(s). These are kept as is.
          </p>
        )}
        <F label="Full description" id="description" uncertain={u.has("description")}>
          <Textarea id="description" rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </F>
        <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <Button type="button" onClick={() => save("published")} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Save & publish
          </Button>
          <Button type="submit" variant="outline" disabled={pending}>Save</Button>
          {footer}
        </div>
      </form>
    );
  },
);
