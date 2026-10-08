"use client";
import "./photo-gallery.css";


import { track } from "@/lib/analytics";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";
import type { CharacterPhoto } from "@/lib/types";

export function PhotoGallery({ photos, title, description, eyebrow = "Такие встречи уже случались" }: {
  photos: CharacterPhoto[]; title: string; description: string; eyebrow?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const open = active !== null;
  const photo = active === null ? null : photos[active];
  const move = (step: number) => { track("media_interact", {media: "gallery", action: step > 0 ? "next" : "previous"}); setActive(index => index === null ? null : (index + step + photos.length) % photos.length); };
  const openPhoto = (index: number, button: HTMLButtonElement) => {
    track("media_interact", {media: "gallery", action: "open"});
    trigger.current = button;
    setActive(index);
  };

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (modal && !modal.open) modal.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (modal?.open) modal.close();
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (active !== null) thumbs.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (!photos.length) return null;
  return <section className="container photo-gallery">
    <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><p>{description}</p></div>
    <div className="photo-gallery-grid">{photos.slice(0, 4).map((item, index) => <button type="button" key={item.url} className="photo-gallery-tile" aria-label={`Открыть фотографию ${index + 1}: ${item.alt}`} onClick={event => openPhoto(index, event.currentTarget)}>
      <Image src={item.url} alt={item.alt} width={720} height={480} sizes="(max-width:600px) 100vw, (max-width:1000px) 50vw, 400px" />
      <span className="photo-gallery-expand" aria-hidden="true"><Maximize2 size={18} /></span>
      <span className="photo-gallery-caption">{item.alt}</span>
    </button>)}</div>
    {photos.length > 2 && <div className={`photo-gallery-actions${photos.length <= 4 ? " photo-gallery-actions-mobile" : ""}`}>
      <button type="button" className="button outline" aria-haspopup="dialog" onClick={event => openPhoto(0, event.currentTarget)}>Все фотографии · {photos.length}<ArrowRight size={18} aria-hidden="true" /></button>
    </div>}
    <p className="photo-gallery-hint">Нажмите на фото, чтобы рассмотреть. Внутри можно листать всю галерею.</p>
    <dialog ref={dialog} className="photo-lightbox" aria-label={title} onClose={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={event => {
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    }}>
      {photo && <div className="photo-lightbox-panel">
        <div className="photo-lightbox-toolbar"><span>{title}</span><button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Закрыть галерею"><X size={23} /></button></div>
        <div className="photo-lightbox-stage" onTouchStart={event => { const point = event.touches[0]; touch.current = { x: point.clientX, y: point.clientY }; }} onTouchEnd={event => {
          const start = touch.current, point = event.changedTouches[0]; touch.current = null;
          if (!start || !point) return;
          const dx = point.clientX - start.x, dy = point.clientY - start.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
        }}>
          <Image key={photo.url} src={photo.url} alt={photo.alt} width={1800} height={1200} sizes="(max-width:700px) 100vw, 90vw" loading="eager" />
          {photos.length > 1 && <><button type="button" className="photo-lightbox-prev" onClick={() => move(-1)} aria-label="Предыдущее фото"><ArrowLeft size={23} /></button><button type="button" className="photo-lightbox-next" onClick={() => move(1)} aria-label="Следующее фото"><ArrowRight size={23} /></button></>}
        </div>
        <div className="photo-lightbox-caption" aria-live="polite" aria-atomic="true"><p>{photo.alt}</p><span>{active! + 1} / {photos.length}</span></div>
        <div ref={thumbs} className="photo-lightbox-thumbs" aria-label="Выбрать фото">{photos.map((item, index) => <button key={item.url} type="button" aria-label={`Фото ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}><Image src={item.url} alt="" width={100} height={70} sizes="80px" /></button>)}</div>
        <span className="photo-lightbox-hint">Листайте стрелками или свайпом · Esc — закрыть</span>
      </div>}
    </dialog>
  </section>;
}
