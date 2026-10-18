"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CatalogFilters, DEFAULT_CATALOG_FILTERS, readCatalogNavigation, saveCatalogNavigation } from "./catalog-navigation";

const isCatalogPage = () => /^\/characters\/?$/.test(window.location.pathname);

export function useCatalogNavigation(categories: readonly string[]) {
  // The server and initial hydration render use the same defaults. Browser-only
  // state is restored in a layout effect before the interactive catalogue paints.
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const current = useRef(filters);
  const cancelRestore = useRef(() => {});

  useLayoutEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let restoreFrame: number | undefined;
    let restoring = false;
    const stopRestore = () => {
      if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame);
      restoreFrame = undefined;
      restoring = false;
    };
    cancelRestore.current = stopRestore;
    const save = () => {
      if (isCatalogPage() && !restoring) saveCatalogNavigation(window.history, current.current, { x: window.scrollX, y: window.scrollY });
    };
    const restore = () => {
      clearTimeout(scrollTimer);
      stopRestore();
      // A departing component may still receive popstate before Next unmounts it.
      if (!isCatalogPage()) return;
      let saved = null;
      try { saved = readCatalogNavigation(window.history.state, categories); } catch { /* Restricted history: keep usable defaults. */ }
      const next = saved ? { search: saved.search, category: saved.category, sortOrder: saved.sortOrder } : DEFAULT_CATALOG_FILTERS;
      current.current = next;
      setFilters(next);
      if (saved?.position) {
        const position = saved.position;
        restoring = true;
        restoreFrame = window.requestAnimationFrame(() => {
          restoreFrame = undefined;
          if (isCatalogPage()) window.scrollTo({ left: position.x, top: position.y, behavior: "instant" });
          restoring = false;
        });
      }
    };
    const onScroll = () => {
      if (restoring) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(save, 150);
    };
    const beforeLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        stopRestore();
        save();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) restore(); };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", save);
    window.addEventListener("scroll", onScroll, { passive: true });
    // Capture before Next's link handler changes the active history entry.
    document.addEventListener("click", beforeLink, true);
    // A newer interaction wins over a pending restoration frame.
    window.addEventListener("pointerdown", stopRestore, { passive: true });
    window.addEventListener("touchstart", stopRestore, { passive: true });
    window.addEventListener("wheel", stopRestore, { passive: true });
    window.addEventListener("keydown", stopRestore);
    return () => {
      clearTimeout(scrollTimer);
      stopRestore();
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", beforeLink, true);
      window.removeEventListener("pointerdown", stopRestore);
      window.removeEventListener("touchstart", stopRestore);
      window.removeEventListener("wheel", stopRestore);
      window.removeEventListener("keydown", stopRestore);
    };
  }, [categories]);

  function updateFilters(patch: Partial<CatalogFilters>) {
    cancelRestore.current();
    const next = { ...current.current, ...patch };
    current.current = next;
    setFilters(next);
    if (isCatalogPage()) saveCatalogNavigation(window.history, next, { x: window.scrollX, y: window.scrollY });
  }
  return { ...filters, updateFilters };
}
