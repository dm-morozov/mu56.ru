// A draft lives in the mounted form, never in browser storage. Identify its
// original CTA context, not the program the visitor later edits in the form.
export type BookingDraftEntry = {
  offering: string;
  character: string;
  tariff: string;
  addons: readonly string[];
  soundRequired: boolean;
  venue: string;
};

export function bookingDraftKey(entry: BookingDraftEntry, pathname: string): string {
  return JSON.stringify([
    pathname, entry.offering, entry.character, entry.tariff,
    [...new Set(entry.addons)].sort(), entry.soundRequired, entry.venue,
  ]);
}

export function resumeBookingDraft(activeKey: string | null, entryKey: string): boolean {
  return activeKey !== null && activeKey === entryKey;
}
