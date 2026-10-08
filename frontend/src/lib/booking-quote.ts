export type BookingQuote = { amount_rub: number; lines: { slug: string; name: string; amount_rub: number }[] };

// The quote already contains sound; only the photographer is priced separately.
export function bookingQuoteTotal(quote: BookingQuote | null, photographerAmount: number | undefined) {
  return quote && photographerAmount !== undefined ? quote.amount_rub + photographerAmount : undefined;
}

export async function requestBookingQuote(url: string, signal: AbortSignal, timeoutMs = 15000): Promise<BookingQuote> {
  const deadline = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, deadline]) });
    const data = await response.json().catch(() => { throw new Error("Не удалось рассчитать стоимость. Попробуйте ещё раз или позвоните нам."); });
    if (!response.ok) throw new Error(data.detail || "Не удалось рассчитать стоимость.");
    return data as BookingQuote;
  } catch (error) {
    if (deadline.aborted && !signal.aborted) throw new Error("Расчёт занимает слишком долго. Проверьте интернет и повторите расчёт или позвоните нам.");
    throw error;
  }
}
