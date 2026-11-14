"use client";

import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      tone="error"
      title="This admin page hit an error"
      description={
        <>
          Usually a Firestore index that&rsquo;s still building. Try again in a minute.
          {error.digest && <span className="mt-2 block font-mono text-xs">ref {error.digest}</span>}
        </>
      }
      action={<Button onClick={reset} className="rounded-full">Try again</Button>}
    />
  );
}
