// This is an interest in a venue, never a confirmed reservation.
export const bookingVenues: Record<string, { name: string; address: string }> = {
  "vinni-puh": { name: "Винни-Пух", address: "Оренбург, Ульянова, 81" },
};

export function bookingVenueForPath(pathname: string): string {
  return pathname.replace(/\/$/, "") === "/venues/vinni-puh" ? "vinni-puh" : "";
}
