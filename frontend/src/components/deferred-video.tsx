"use client";

import { useEffect, useRef, useState } from "react";

// The native player remains usable; only its decorative poster is deferred.
export function DeferredVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const player = useRef<HTMLVideoElement>(null);
  const [showPoster, setShowPoster] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setShowPoster(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShowPoster(true);
        observer.disconnect();
      }
    }, { rootMargin: "400px" });
    if (player.current) observer.observe(player.current);
    return () => observer.disconnect();
  }, []);
  return <video ref={player} controls playsInline preload="none" poster={showPoster ? poster : undefined} aria-label={label}>
    <source src={src} type="video/mp4" />
    Ваш браузер не поддерживает видео. <a href={src}>Открыть запись праздника</a>.
  </video>;
}
