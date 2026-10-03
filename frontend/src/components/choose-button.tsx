"use client";
import { ArrowUpRight } from "lucide-react";
import { choose, useAppDispatch } from "./store-provider";

export function ChooseButton({ children = "Обсудить праздник", offering, character, tariff, className = "button orange" }: { children?: React.ReactNode; offering?: string; character?: string; tariff?: string; className?: string }) {
  const dispatch = useAppDispatch();
  return <button className={className} onClick={() => dispatch(choose({ offering, character, tariff }))}>{children}<ArrowUpRight size={19} aria-hidden="true" /></button>;
}
