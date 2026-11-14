"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/** Modal on desktop, bottom sheet on phones. Closing goes back to the list. */
export function EventModal({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const close = (open: boolean) => {
    if (!open) router.back();
  };
  if (desktop === null) return null;
  if (desktop) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-6 sm:max-w-6xl sm:p-8">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">Event details</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open onOpenChange={close}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">Event details</DrawerDescription>
        <div className="overflow-y-auto px-4 pb-10 pt-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
