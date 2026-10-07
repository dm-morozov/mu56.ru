"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Offering } from "@/lib/types";
import styles from "./program-picker.module.css";

const groups = [["animation", "Анимация"], ["transformer", "Большие герои"], ["seasonal", "Новый год"], ["package", "Готовые пакеты"], ["show", "Отдельные шоу"]];

export function ProgramPicker({ offerings, value, onChange, label }: { offerings: Offering[]; value: string; onChange: (slug: string) => void; label: string }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const sections = groups.map(([kind, title]) => ({ title, items: offerings.filter(item => item.kind === kind) })).filter(group => group.items.length);
  const options = [{ slug: "", name: "Помогите выбрать" }, ...sections.flatMap(group => group.items)];
  const current = Math.max(0, options.findIndex(option => option.slug === value));
  const activeIndex = Math.min(active, options.length - 1);
  function pick(slug: string) { onChange(slug); setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, id]);
  function option(slug: string, name: string) {
    const index = options.findIndex(item => item.slug === slug);
    return <div key={slug} id={`${id}-option-${index}`} role="option" aria-selected={value === slug} className={`${styles.option} ${activeIndex === index ? styles.active : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => pick(slug)}><span>{name}</span>{value === slug && <Check size={18} aria-hidden="true" />}</div>;
  }
  return <div className={styles.picker} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>{label}</label>
    <input type="hidden" name="offering" value={value} />
    <button ref={trigger} id={`${id}-trigger`} type="button" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined} className={styles.trigger}
      onClick={() => { setActive(current); setOpen(state => !state); }}
      onKeyDown={event => {
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault(); setOpen(true);
          setActive(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : !open ? current : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if (open && ["Enter", " "].includes(event.key)) { event.preventDefault(); pick(options[activeIndex].slug); }
        else if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        else if (event.key === "Tab") setOpen(false);
      }}><span id={`${id}-value`}>{offerings.find(item => item.slug === value)?.name || "Помогите выбрать"}</span><ChevronDown size={18} aria-hidden="true" /></button>
    {open && <div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className={styles.list}>
      {option("", "Помогите выбрать")}
      {sections.map(section => <div key={section.title} role="group" aria-label={section.title}><div className={styles.heading} aria-hidden="true">{section.title}</div>{section.items.map(item => option(item.slug, item.name))}</div>)}
    </div>}
  </div>;
}
