/** Show a complete catalogue range, never a partial or invented entry price. */
export function programmeRange(values: readonly (number | null | undefined)[]) {
  if (!values.length || values.some(value => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) return null;
  const numbers = values as readonly number[];
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}
