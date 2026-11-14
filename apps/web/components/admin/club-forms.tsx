"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, CATEGORY_META, type Category } from "@clubo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addClub, importClubsCsv } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export function CategoryPicker({ value, onChange }: { value: Category[]; onChange: (v: Category[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              on ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent",
            )}
          >
            {CATEGORY_META[c].emoji} {c}
          </button>
        );
      })}
    </div>
  );
}

export function AddClubDialog() {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [interval, setInterval] = useState("24");
  const [cats, setCats] = useState<Category[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> Add club
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a club</DialogTitle>
          <DialogDescription>Public Instagram accounts only. The name fills in from the first scrape if you leave it blank.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addClub({ igHandle: handle, name, website, category: cats, scrapeIntervalHours: interval });
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message ?? "Added");
              setOpen(false);
              setHandle("");
              setName("");
              setWebsite("");
              setCats([]);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="handle">Instagram handle or URL</Label>
              <Input id="handle" required placeholder="calhacks" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" placeholder="Cal Hacks" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Bio link (optional)</Label>
              <Input id="website" type="url" placeholder="https://linktr.ee/…" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interval">Scrape every (hours)</Label>
              <Input id="interval" type="number" min={6} max={336} value={interval} onChange={(e) => setInterval(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categories</Label>
            <CategoryPicker value={cats} onChange={setCats} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Add club
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportCsvDialog() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload aria-hidden /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import clubs</DialogTitle>
          <DialogDescription>
            One club per line: <code className="font-mono text-xs">handle,name,Category|Category,intervalHours</code>. Only the handle is required.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"calhacks,Cal Hacks,Tech,24\nucberkeleyasuc,ASUC,Political/Advocacy|Social,48"}
          className="font-mono text-xs"
        />
        <Button
          disabled={pending || !csv.trim()}
          onClick={() =>
            start(async () => {
              const r = await importClubsCsv(csv);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message ?? "Imported", {
                description: r.data?.skipped.length ? r.data.skipped.slice(0, 5).join("\n") : undefined,
              });
              setOpen(false);
              setCsv("");
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />} Import
        </Button>
      </DialogContent>
    </Dialog>
  );
}
