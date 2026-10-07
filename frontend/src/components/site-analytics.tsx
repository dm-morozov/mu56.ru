"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CHOICE, METRIKA_ID, safePath, track } from "@/lib/analytics";
import { useSelection } from "./store-provider";

function choice() { try { return localStorage.getItem(ANALYTICS_CHOICE); } catch { return null; } }
const DISMISSED_UNTIL = "mu56-analytics-dismissed-until";
const DISMISS_DURATION = 24 * 60 * 60 * 1000;
function dismissalExpiry() {
  try {
    const expiry = Number(localStorage.getItem(DISMISSED_UNTIL));
    return Number.isFinite(expiry) && expiry > 0 ? expiry : 0;
  } catch { return 0; }
}
function stop() {
  window.mu56AnalyticsReady = false;
  try { window.ym?.(METRIKA_ID, "destruct"); } catch { /* Blocking analytics must not block the site. */ }
  for (const cookie of document.cookie.split(";")) {
    const key = cookie.trim().split("=")[0];
    if (!key.startsWith("_ym_")) continue;
    for (const domain of ["", ";domain=mu56.ru", ";domain=.mu56.ru"]) document.cookie = `${key}=;max-age=0;path=/${domain};SameSite=Lax;Secure`;
  }
}

export function AnalyticsSettingsButton() {
  return <button type="button" className="analytics-settings" onClick={() => window.dispatchEvent(new Event("mu56-analytics-settings"))}>Настройки аналитики</button>;
}
export function SiteAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const selection = useSelection();
  const [ready, setReady] = useState(false), [show, setShow] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || location.hostname !== "mu56.ru") return;
    function sync() {
      const accepted = choice() === "accepted", expiry = dismissalExpiry();
      setDismissedUntil(accepted ? 0 : expiry);
      setShow(!accepted && expiry <= Date.now()); setReady(accepted);
      if (!accepted) stop();
    }
    function settings() { setShow(true); }
    sync();
    window.addEventListener("mu56-analytics-settings", settings);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("mu56-analytics-settings", settings); window.removeEventListener("storage", sync); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || location.hostname !== "mu56.ru" || ready || !dismissedUntil) return;
    const timer = window.setTimeout(() => {
      if (choice() !== "accepted" && dismissalExpiry() <= Date.now()) setShow(true);
    }, Math.min(Math.max(0, dismissedUntil - Date.now()), DISMISS_DURATION));
    return () => window.clearTimeout(timer);
  }, [enabled, ready, dismissedUntil]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    function init() {
      if (cancelled || choice() !== "accepted") return;
      if (!window.ym) return;
      let referrer = "";
      try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch { /* No raw referrer. */ }
      try { window.ym(METRIKA_ID, "init", { defer: true, url: `https://mu56.ru${safePath(location.pathname) || "/"}`, referrer, webvisor: false, clickmap: false, trackLinks: false, trackHash: false, accurateTrackBounce: true }); } catch { return; }
      window.mu56AnalyticsReady = true;
      previous.current = null;
      window.dispatchEvent(new Event("mu56-analytics-ready"));
    }
    const existing = document.getElementById("mu56-metrika") as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") init();
    else if (existing) existing.addEventListener("load", init, { once: true });
    else {
      const ym = ((...args: unknown[]) => { ym.a!.push(args); }) as NonNullable<typeof window.ym>;
      ym.a = []; ym.l = Date.now(); window.ym = ym;
      const script = document.createElement("script"); script.id = "mu56-metrika"; script.async = true;
      script.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
      script.onload = () => { script.dataset.loaded = "true"; init(); };
      document.head.appendChild(script);
    }
    return () => { cancelled = true; stop(); };
  }, [ready]);
  useEffect(() => {
    function hit() {
      const path = safePath(pathname || "");
      if (!ready || !window.mu56AnalyticsReady || !path || previous.current === path) return;
      let referer = previous.current ? `https://mu56.ru${previous.current}` : "";
      if (!referer && document.referrer) { try { referer = new URL(document.referrer).origin; } catch { /* No raw referrer. */ } }
      try { window.ym?.(METRIKA_ID, "hit", `https://mu56.ru${path}`, { title: "Мир Улыбок", referer }); } catch { return; }
      previous.current = path;
    }
    hit(); window.addEventListener("mu56-analytics-ready", hit);
    return () => window.removeEventListener("mu56-analytics-ready", hit);
  }, [pathname, ready]);
  useEffect(() => {
    function click(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const media = target?.closest<HTMLElement>("[data-analytics-media]");
      if (media) track("media_interact", { media: media.dataset.analyticsMedia || "gallery", action: media.dataset.analyticsAction || "open" });
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      let channel = "";
      try {
        const url = new URL(link.href);
        channel = url.protocol === "tel:" ? "phone" : ({"t.me":"telegram", "max.ru":"max", "vk.com":"vk", "vk.ru":"vk", "www.vk.com":"vk", "www.vk.ru":"vk", "www.avito.ru":"avito", "avito.ru":"avito", "www.instagram.com":"instagram", "instagram.com":"instagram"} as Record<string, string>)[url.hostname] || "";
      } catch { return; }
      if (channel) track("contact_click", { channel });
    }
    function video(event: Event) { if (event.target instanceof HTMLVideoElement) track("media_interact", { media: "video", action: event.type === "ended" ? "complete" : "play" }); }
    document.addEventListener("click", click); document.addEventListener("play", video, true); document.addEventListener("ended", video, true);
    return () => { document.removeEventListener("click", click); document.removeEventListener("play", video, true); document.removeEventListener("ended", video, true); };
  }, []);
  function choose(accepted: boolean) {
    const expiry = accepted ? 0 : Date.now() + DISMISS_DURATION;
    try {
      localStorage.setItem(ANALYTICS_CHOICE, accepted ? "accepted" : "denied");
      if (accepted) localStorage.removeItem(DISMISSED_UNTIL);
      else localStorage.setItem(DISMISSED_UNTIL, String(expiry));
    } catch { stop(); setReady(false); setShow(false); return; }
    setDismissedUntil(expiry);
    if (!accepted) stop(); setReady(accepted); setShow(false);
  }
  if (!show || selection.open || !safePath(pathname || "")) return null;
  return <aside className="analytics-notice" aria-label="Настройки аналитики">
    <button type="button" className="analytics-notice-close" aria-label="Закрыть без включения аналитики" onClick={() => choose(false)}><span aria-hidden="true">×</span></button>
    <p>С вашего согласия используем cookies и Яндекс.Метрику для статистики посещений и действий. <Link href="/privacy">Подробнее</Link></p>
    <div><button type="button" className="button orange" onClick={() => choose(true)}>Согласен</button></div>
  </aside>;
}
