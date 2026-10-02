import { cache } from "react";
import { Character, Offering } from "./types";

const origin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
export async function allPages<T>(route: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetch(`${origin}/api/v1/${route}/?page=${page}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog unavailable: ${response.status}`);
    const data = await response.json() as { results: T[]; next: string | null };
    items.push(...data.results);
    if (!data.next) return items;
  }
  throw new Error("Catalog pagination limit exceeded");
}
export const getOfferings = cache(() => allPages<Offering>("offerings"));
export const getCharacters = cache(() => allPages<Character>("characters"));
