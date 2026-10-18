"use client";
import { ArrowUpRight } from "lucide-react";
import { choose, useAppDispatch } from "./store-provider";
import { usePathname } from "next/navigation";
import { occasionRequiresSound } from "@/lib/occasions";
import { bookingVenueForPath } from "@/lib/booking-venue";

export function ChooseButton({ children = "Обсудить праздник", offering, character, tariff, addons, soundRequired: requireSound = false, className = "button orange", ariaLabel }: { children?: React.ReactNode; offering?: string; character?: string; tariff?: string; addons?: string[]; soundRequired?: boolean; className?: string; ariaLabel?: string }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const soundRequired = requireSound || occasionRequiresSound(pathname);
  const venue = bookingVenueForPath(pathname);
  return <button type="button" className={className} aria-haspopup="dialog" aria-label={ariaLabel} onClick={() => dispatch(choose({ offering, character, tariff, addons, soundRequired, venue }))}>{children}<ArrowUpRight size={19} aria-hidden="true" /></button>;
}
