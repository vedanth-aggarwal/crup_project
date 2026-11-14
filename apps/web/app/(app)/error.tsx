"use client";

import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      tone="error"
      title="Couldn't load this page"
      description="Something went wrong on our end. Give it another try."
      action={<Button onClick={reset} className="rounded-full">Try again</Button>}
    />
  );
}
