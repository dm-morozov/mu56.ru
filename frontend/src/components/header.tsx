"use client";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { MessengerLinks } from "./messenger-links";

const links = [["/transformers", "Трансформеры"], ["/animators", "Аниматоры"], ["/packages", "Пакеты"], ["/characters", "Персонажи"], ["/shows", "Все услуги"], ["/new-year", "Новый год"]];
const moreLinks = [["/extras", "Дополнения"], ["/holidays", "Праздники для групп"], ["/gallery", "Фото праздников"], ["/reviews", "Отзывы"], ["/articles", "Идеи для праздника"], ["/contacts", "Контакты"]];
export function Header() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 800px)");
    const onBreakpointChange = () => {
      if (mobile.matches) return;
      setOpen(false);
      const focused = document.activeElement;
      // A mobile-only link or toggle must not retain focus after it disappears.
      if (focused instanceof HTMLElement && !focused.getClientRects().length &&
          (focused === buttonRef.current || navRef.current?.contains(focused))) {
        navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
      }
    };
    mobile.addEventListener("change", onBreakpointChange);
    return () => mobile.removeEventListener("change", onBreakpointChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Reopening a previously scrolled menu must keep its first focused link visible.
    if (navRef.current) navRef.current.scrollTop = 0;
    // The toggle follows the nav in DOM order, so move into its revealed links.
    navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };
    const onLeaveHeader = (event: Event) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onLeaveHeader);
    document.addEventListener("focusin", onLeaveHeader);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onLeaveHeader);
      document.removeEventListener("focusin", onLeaveHeader);
    };
  }, [open]);
  return <>
    <div className="topline"><div className="container"><span><i />Детские праздники в Оренбурге</span><span>Праздник на вашей площадке — в помещении или на улице</span></div></div>
    <header ref={headerRef} className="header"><div className="container header-inner">
      <Link href="/" className="brand" onClick={() => setOpen(false)}><Brand /></Link>
      <nav ref={navRef} id="main-navigation" aria-label="Основное меню" className={open ? "nav is-open" : "nav"}>{links.map(([url, text]) => <Link key={url} href={url} className={url === "/new-year" ? "nav-seasonal" : undefined} aria-current={pathname.startsWith(url) ? "page" : undefined} onClick={() => setOpen(false)}>{text}</Link>)}{moreLinks.map(([url, text]) => <Link key={url} href={url} className="mobile-gallery" aria-current={pathname.startsWith(url) ? "page" : undefined} onClick={() => setOpen(false)}>{text}</Link>)}<MessengerLinks className="menu-messengers" /></nav>
      <div className="header-contacts"><MessengerLinks className="header-messengers" iconsOnly /><a className="header-phone" href="tel:+79033922229" aria-label="Позвонить: +7 903 392-22-29"><Phone size={17} /> <span>+7 903 392-22-29</span></a></div>
      <button ref={buttonRef} type="button" className="menu-button" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-controls="main-navigation" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>{open ? <X /> : <Menu />}</button>
    </div></header>
  </>;
}
