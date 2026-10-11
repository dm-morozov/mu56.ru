export type BookingQuote = { amount_rub: number; lines: { slug: string; name: string; amount_rub: number }[] };
type QuoteFailureReason = "network" | "timeout" | "rate_limit" | "server" | "validation" | "unknown";
const quoteReasons: readonly QuoteFailureReason[] = ["network", "timeout", "rate_limit", "server", "validation", "unknown"];
function quoteFailure(message: string, reason: QuoteFailureReason, status = 0) {
  return Object.assign(new Error(message), { quoteReason: reason, quoteStatus: status });
}
// Return fixed diagnostic fields only. Never send the exception message or URL.
export function bookingQuoteErrorInfo(error: unknown): { reason: QuoteFailureReason; status: number } {
  if (error instanceof Error && "quoteReason" in error && "quoteStatus" in error) {
    const reason = quoteReasons.find(value => value === error.quoteReason) || "unknown";
    const status = typeof error.quoteStatus === "number" && Number.isInteger(error.quoteStatus) && error.quoteStatus >= 100 && error.quoteStatus <= 599 ? error.quoteStatus : 0;
    return { reason, status };
  }
  return { reason: error instanceof TypeError ? "network" : "unknown", status: 0 };
}

// The quote already contains sound; only the photographer is priced separately.
export function bookingQuoteTotal(quote: BookingQuote | null, photographerAmount: number | undefined) {
  return quote && photographerAmount !== undefined ? quote.amount_rub + photographerAmount : undefined;
}

export async function requestBookingQuote(url: string, signal: AbortSignal, timeoutMs = 15000): Promise<BookingQuote> {
  const deadline = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, deadline]) });
    const reason = response.status === 429 ? "rate_limit" : response.status >= 500 ? "server" : response.status === 400 || response.status === 422 ? "validation" : "unknown";
    const data = await response.json().catch(() => { throw quoteFailure("Не удалось рассчитать стоимость. Попробуйте ещё раз или позвоните нам.", response.ok ? "server" : reason, response.status); });
    if (!response.ok) throw quoteFailure(typeof data?.detail === "string" ? data.detail : "Не удалось рассчитать стоимость.", reason, response.status);
    return data as BookingQuote;
  } catch (error) {
    if (deadline.aborted && !signal.aborted) throw quoteFailure("Расчёт занимает слишком долго. Проверьте интернет и повторите расчёт или позвоните нам.", "timeout");
    throw error;
  }
}
