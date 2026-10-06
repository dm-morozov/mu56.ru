"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BookingCatalog } from "@/lib/booking-catalog";
import { useSelection } from "./store-provider";

const LeadDialog = dynamic(() => import("./lead-dialog").then(module => module.LeadDialog), {
  ssr: false,
  loading: () => <p className="booking-loading" role="status">Открываем форму…</p>,
});

export function BookingDialog({ catalog }: { catalog: BookingCatalog }) {
  const selection = useSelection();
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (selection.open) setRequested(true);
  }, [selection.open]);

  // Keep the loaded form mounted so closing it and opening another offer
  // follows the same selection/reset behavior as the original dialog.
  return requested ? <LeadDialog catalog={catalog} /> : null;
}
