"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Character } from "@/lib/types";

const normalize = (text: string) => text.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();

export function HeroPicker({ heroes, value, onChange, label }: { heroes: Character[]; value: string; onChange: (slug: string) => void; label: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = heroes.find(hero => hero.slug === value);
  const words = normalize(query).split(" ").filter(Boolean);
  const filtered = heroes.filter(hero => words.every(word => normalize(hero.name).includes(word)));
  const options = [{ slug: "", name: "Согласуем позже", availability: "available" }, ...filtered];
  const activeIndex = Math.min(active, options.length - 1);
  function pick(slug: string) {
    onChange(slug);
    setOpen(false);
    setQuery("");
  }
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, id]);
  return <div className="hero-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="hero-picker-input"><Search size={17} aria-hidden="true" />
      <input ref={input} id={`${id}-input`} role="combobox" type="text" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined} aria-describedby={`${id}-help`} placeholder="Согласуем позже — или найдите героя" value={open ? query : selected?.name || ""}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onClick={() => { if (!open) { setOpen(true); setQuery(""); setActive(0); } }}
        onChange={event => { const text = event.target.value; setQuery(text); setOpen(true); setActive(text.trim() ? 1 : 0); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(current => event.key === "ArrowDown" ? (open ? (Math.min(current, options.length - 1) + 1) % options.length : 1 % options.length) : (Math.min(current, options.length - 1) - 1 + options.length) % options.length);
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); pick(options[activeIndex].slug);
          } else if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery("");
          } else if (event.key === "Tab") setOpen(false);
        }} />
      <button type="button" tabIndex={-1} aria-label={open ? "Закрыть список героев" : "Открыть список героев"} onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); setOpen(true); setQuery(""); setActive(0); } }}><ChevronDown size={18} aria-hidden="true" /></button>
    </div>
    {open && <div className="hero-picker-results">
      <div id={`${id}-list`} role="listbox" aria-label={label} className="hero-picker-list">{options.map((hero, index) => <button key={hero.slug} id={`${id}-option-${index}`} type="button" role="option" tabIndex={-1} aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => pick(hero.slug)}><span>{hero.name}</span>{hero.availability === "check" && <small>Доступность уточним</small>}</button>)}</div>
      <p role="status">{filtered.length ? `Найдено героев: ${filtered.length}` : "Героев не найдено. Попробуйте другое имя."}</p>
    </div>}
    <p id={`${id}-help`} className="hero-picker-help">Введите имя или его часть. Например: «паук» или «Гарри».</p>
  </div>;
}
