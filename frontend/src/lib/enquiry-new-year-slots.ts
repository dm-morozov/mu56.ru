// Exact published tariff slots. A slot does not imply a year or availability.
export const fixedNewYearSlots = [
  { code: "eve-18", label: "31 декабря · 18:00", monthDay: "12-31", time: "18:00" },
  { code: "eve-20", label: "31 декабря · 20:00", monthDay: "12-31", time: "20:00" },
  { code: "eve-22", label: "31 декабря · 22:00", monthDay: "12-31", time: "22:00" },
  { code: "night-00", label: "1 января · 00:00", monthDay: "01-01", time: "00:00" },
  { code: "night-02", label: "1 января · 02:00", monthDay: "01-01", time: "02:00" },
] as const;

export function fixedNewYearSlot(code: string | undefined) {
  return fixedNewYearSlots.find(slot => slot.code === code);
}
