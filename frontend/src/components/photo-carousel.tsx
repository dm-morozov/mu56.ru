"use client";

import { Children, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./photo-carousel.module.css";

type PhotoCarouselProps = {
  id: string;
  label: string;
  children: ReactNode;
  variant?: "photos" | "characters" | "reviews";
};

type Position = {
  first: number;
  last: number;
  previous: boolean;
  next: boolean;
};

const edgeTolerance = 2;

export function PhotoCarousel({ id, label, children, variant = "photos" }: PhotoCarouselProps) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const requestedLeft = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState<Position>({
    first: total ? 1 : 0,
    last: variant === "characters" ? Math.min(2, total) : Math.min(1, total),
    previous: false,
    next: false,
  });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const bounds = track.getBoundingClientRect();
    const computed = window.getComputedStyle(track);
    const left = bounds.left + parseFloat(computed.paddingLeft);
    const right = bounds.right - parseFloat(computed.paddingRight);
    const visible: number[] = [];
    let mostVisible = 0;
    let largestIntersection = 0;

    Array.from(track.children).forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const intersection = Math.max(0, Math.min(rect.right, right) - Math.max(rect.left, left));
      if (intersection > largestIntersection) {
        mostVisible = index;
        largestIntersection = intersection;
      }
      // The next-card peek is a browsing cue, not another displayed card.
      if (intersection >= rect.width - edgeTolerance) visible.push(index);
    });

    const next: Position = {
      first: (visible[0] ?? mostVisible) + 1,
      last: (visible[visible.length - 1] ?? mostVisible) + 1,
      previous: track.scrollLeft > edgeTolerance,
      next: track.scrollWidth - track.clientWidth - track.scrollLeft > edgeTolerance,
    };
    setPosition(current => current.first === next.first && current.last === next.last
      && current.previous === next.previous && current.next === next.next ? current : next);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    let settled = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
      window.clearTimeout(settled);
      settled = window.setTimeout(() => { requestedLeft.current = null; }, 150);
    };
    const onResize = () => {
      requestedLeft.current = null;
      measure();
    };
    const onScrollEnd = () => {
      requestedLeft.current = null;
      measure();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(track);
    Array.from(track.children).forEach(slide => observer.observe(slide));
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    measure();
    setReady(true);

    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
      cancelAnimationFrame(frame);
      window.clearTimeout(settled);
      requestedLeft.current = null;
    };
  }, [measure, total, variant]);

  function move(direction: "previous" | "next" | "first" | "last") {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;

    const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
    const stops = Array.from(track.children, slide => Math.min(maximum,
      (slide as HTMLElement).offsetLeft - first.offsetLeft));
    // A burst of button presses advances from the requested destination,
    // rather than repeatedly restarting the same in-progress smooth scroll.
    const current = requestedLeft.current ?? track.scrollLeft;
    let target: number;
    if (direction === "first") target = 0;
    else if (direction === "last") target = maximum;
    else if (direction === "previous") target = stops.filter(stop => stop < current - edgeTolerance).pop() ?? 0;
    else target = stops.find(stop => stop > current + edgeTolerance) ?? maximum;

    requestedLeft.current = target;
    track.scrollTo({
      left: target,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Links, buttons and fields inside cards keep their native keyboard behavior.
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const direction = { ArrowLeft: "previous", ArrowRight: "next", Home: "first", End: "last" }[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction as "previous" | "next" | "first" | "last");
  }

  if (!total) return null;

  return (
    <div id={id} className={styles.carousel} role="region" aria-roledescription="карусель" aria-label={label} data-photo-carousel={variant}>
      <p id={`${id}-instructions`} className={styles.srOnly}>
        Листайте карточки горизонтально или кнопками. Когда область карточек в фокусе, используйте стрелки влево и вправо, Home и End.
      </p>
      <div
        ref={trackRef}
        id={`${id}-track`}
        className={`${styles.track} ${styles[variant]}`}
        role="group"
        aria-label={`Карточки: ${label}`}
        aria-describedby={`${id}-instructions`}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={() => { requestedLeft.current = null; }}
        data-carousel-track
      >
        {slides.map((slide, index) => (
          <div className={styles.slide} role="group" aria-roledescription="слайд" aria-label={`${index + 1} из ${total}`} key={index} data-carousel-slide>
            {slide}
          </div>
        ))}
      </div>
      <div className={styles.controls}>
        <button className={styles.control} type="button" onClick={() => move("previous")} disabled={!ready || !position.previous} aria-label={`Предыдущие карточки: ${label}`} aria-controls={`${id}-track`} data-carousel-previous>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" /></svg>
        </button>
        <span className={styles.count} aria-live="polite" aria-atomic="true" data-carousel-count>
          <span className={styles.srOnly}>Карточки </span>
          {position.first === position.last ? position.first : `${position.first}–${position.last}`}
          <span aria-hidden="true"> / </span><span className={styles.srOnly}> из </span>{total}
        </span>
        <button className={styles.control} type="button" onClick={() => move("next")} disabled={!ready || !position.next} aria-label={`Следующие карточки: ${label}`} aria-controls={`${id}-track`} data-carousel-next>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6M4 12h12" /></svg>
        </button>
      </div>
    </div>
  );
}
