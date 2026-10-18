"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { matchesCharacterSearch } from "@/lib/character-search";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Character } from "@/lib/types";
import { CharacterCard } from "./cards";
import { ChooseButton } from "./choose-button";
import "./character-catalog.css";

const shortNames: Record<string, string> = { "Мультфильмы и сказки": "Мультфильмы", "Игровые и тематические программы": "Игры и тренды" };
const firstHeroes = ["spider-man", "tiktok", "captain-america", "chase"];
// Первые 12 позиций подтверждены владельцем; остальные — предварительный порядок.
const popularHeroes = [
  "bumblebee", "spider-man", "tiktok", "captain-america", "chase", "batman",
  "black-spider-man", "leon", "among-us", "superman", "creeper", "mcqueen",
  "new-year-duo", "optimus-prime", "iron-man", "ninja-turtle", "ladybug",
  "harry-potter", "cat-noir", "jack-sparrow", "football", "deadpool",
  "alice", "hatter", "aladdin", "clown-kesha", "graduation-host",
  "luke-skywalker", "prince", "hawaiian", "kutamba", "james-bond",
];
const categoryOrder = ["Большие герои", "Новый год", "Супергерои", "Игровые и тематические программы", "Приключения", "Мультфильмы и сказки"];
const categoryRank = (name: string) => { const index = categoryOrder.indexOf(name); return index < 0 ? categoryOrder.length : index; };
const heroRank = (slug: string) => { const index = firstHeroes.indexOf(slug); return index < 0 ? firstHeroes.length : index; };
const popularityRank = (slug: string) => { const index = popularHeroes.indexOf(slug); return index < 0 ? popularHeroes.length : index; };
type SortOrder = "category" | "popular" | "name";
export function CharacterCatalog({ characters }: { characters: Character[] }) {
  const [category, setCategory] = useState("Все герои"), [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("category");
  const input = useRef<HTMLInputElement>(null);
  const categories = ["Все герои", ...Array.from(new Set(characters.map(item => item.category))).sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b, "ru"))];
  const searchMatches = useMemo(() => characters.filter(item => matchesCharacterSearch(item.name, search)), [characters, search]);
  const filtered = useMemo(() => {
    const matches = searchMatches.filter(item => category === "Все герои" || item.category === category);
    return matches.sort((a, b) => {
      const byName = () => a.name.localeCompare(b.name, "ru") || a.slug.localeCompare(b.slug);
      if (sortOrder === "name") return byName();
      if (sortOrder === "popular") return popularityRank(a.slug) - popularityRank(b.slug) || byName();
      return categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category, "ru") || heroRank(a.slug) - heroRank(b.slug) || byName();
    });
  }, [searchMatches, category, sortOrder]);
  const hasFilters = !!search.trim() || category !== "Все герои";
  function resetFilters() {
    setSearch(""); setCategory("Все герои"); input.current?.focus();
  }
  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => track("catalog_search", {results: filtered.length}), 800);
    return () => clearTimeout(timer);
  }, [search, filtered.length]);
  return <>
    <div className="catalog-tools">
      <div className="catalog-search"><label htmlFor="character-search">Найти героя</label><div className="search-wrap"><Search size={20} aria-hidden="true" /><input ref={input} id="character-search" type="search" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" aria-controls="character-results" placeholder="Имя героя, например «паук»" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Очистить поиск" onClick={() => { setSearch(""); input.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}</div></div>
      <label className="catalog-sort"><span>Порядок героев</span><select value={sortOrder} onChange={event => { track("catalog_filter", {action: "sort", sort: event.target.value}); setSortOrder(event.target.value as SortOrder); }}><option value="category">По категориям</option><option value="popular">Популярные сначала</option><option value="name">По имени: А–Я</option></select></label>
    </div>
    <div className="category-tabs" role="group" aria-label="Категории персонажей">{categories.map(item => <button type="button" key={item} aria-pressed={item === category} aria-controls="character-results" onClick={() => { track("catalog_filter", {action: "filter", category_index: categories.indexOf(item)}); setCategory(item); }}>{shortNames[item] || item}</button>)}</div>
    <div className="catalog-results"><span className="catalog-count" role="status" aria-atomic="true"><SlidersHorizontal size={16} aria-hidden="true" /> Найдено: {filtered.length}{category !== "Все герои" && ` · ${shortNames[category] || category}`}</span>{hasFilters && <button type="button" className="catalog-reset" onClick={resetFilters}>Сбросить фильтры<X size={15} aria-hidden="true" /></button>}<p className="catalog-sort-note">{sortOrder === "popular" ? "Сначала — самые востребованные герои «Мира Улыбок»." : sortOrder === "name" ? "Герои в алфавитном порядке." : "Большие герои → Новый год → супергерои → игры и тренды → приключения → мультфильмы."}</p></div>
    <div id="character-results">{filtered.length ? <div className="character-grid">{filtered.map((character, index) => <CharacterCard key={character.slug} character={character} index={index} headingLevel={2} />)}</div> : <div className="empty-search"><h2>{category !== "Все герои" && searchMatches.length ? "В этой категории совпадений нет" : "Такого героя пока не нашли"}</h2><p>{category !== "Все герои" && searchMatches.length ? "Попробуйте тот же поиск во всех категориях — там есть подходящие имена." : "Попробуйте часть имени или расскажите нам, какой герой нравится ребёнку."}</p><div className="catalog-empty-actions">{category !== "Все герои" && searchMatches.length > 0 && <button type="button" className="button orange" onClick={() => { setCategory("Все герои"); input.current?.focus(); }}>Искать во всех категориях</button>}<button type="button" className="button outline" onClick={resetFilters}>Показать всех</button>{!searchMatches.length && <ChooseButton className="button orange">Помогите выбрать героя</ChooseButton>}</div></div>}</div>
  </>;
}
