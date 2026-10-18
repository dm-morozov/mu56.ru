"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingCatalog } from "@/lib/booking-catalog";
import { close, useAppDispatch, useSelection } from "./store-provider";

const LeadDialog = dynamic(() => import("./lead-dialog").then(module => module.LeadDialog), {
  ssr: false,
  loading: () => <p className="booking-loading" role="status">Открываем форму…</p>,
});

export function BookingDialog({ catalog }: { catalog: BookingCatalog }) {
  const selection = useSelection();
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const keepSubmissionVisible = useRef(false);
  const [requested, setRequested] = useState(false);
  const onSubmissionStateChange = useCallback((pending: boolean) => {
    // Keep both the attempt and its result visible for this opening. The HTTP
    // response may arrive before a slow Back/Forward transition commits.
    if (pending) keepSubmissionVisible.current = true;
  }, []);

  useEffect(() => {
    if (!selection.open) keepSubmissionVisible.current = false;
  }, [selection.open]);

  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;
    // The root layout survives Back/Forward. Do not leave an idle enquiry
    // covering a different page, including when its lazy chunk is still loading.
    // An already-sent request must keep its pending/result UI: closing it is
    // not cancellation and could leave the visitor unsure whether it was saved.
    if (!keepSubmissionVisible.current) dispatch(close());
  }, [pathname, dispatch]);

  useEffect(() => {
    if (selection.open) setRequested(true);
  }, [selection.open]);

  // Keep the loaded form mounted so closing it and opening another offer
  // follows the same selection/reset behavior as the original dialog.
  return requested ? <LeadDialog catalog={catalog} onSubmissionStateChange={onSubmissionStateChange} /> : null;
}
