"use client";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";

const links = [["/transformers", "Трансформеры"], ["/packages", "Пакеты"], ["/characters", "Персонажи"], ["/shows", "Шоу"], ["/extras", "Дополнения"]];
export function Header() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return <>
    <div className="topline"><div className="container"><span><i />Детские праздники в Оренбурге</span><span>Праздник на вашей площадке — в помещении или на улице</span></div></div>
    <header className="header"><div className="container header-inner">
      <Link href="/" className="brand" aria-label="Мир Улыбок — главная" onClick={() => setOpen(false)}><Brand /></Link>
      <nav id="main-navigation" aria-label="Основное меню" className={open ? "nav is-open" : "nav"}>{links.map(([url, text]) => <Link key={url} href={url} aria-current={pathname.startsWith(url) ? "page" : undefined} onClick={() => setOpen(false)}>{text}</Link>)}<Link href="/gallery" className="mobile-gallery" onClick={() => setOpen(false)}>Фото праздников</Link></nav>
      <a className="header-phone" href="tel:+79033922229" aria-label="Позвонить: +7 903 392-22-29"><Phone size={17} /> <span>+7 903 392-22-29</span></a>
      <button ref={buttonRef} className="menu-button" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-controls="main-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div></header>
  </>;
}
