import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="Event not found"
      description="It may have been removed, or the link is wrong."
      action={<Button asChild className="rounded-full"><Link href="/">Back to the feed</Link></Button>}
    />
  );
}
