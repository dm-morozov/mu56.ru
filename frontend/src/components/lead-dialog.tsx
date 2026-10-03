"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Phone, X } from "lucide-react";
import { close, useAppDispatch, useSelection } from "./store-provider";
import { Offering, basePrice, rubles } from "@/lib/types";

const ordinaryHero = (hero: Offering["characters"][number]) => !["bumblebee", "optimus-prime", "iron-man"].includes(hero.slug) && !["Большие герои", "Новый год"].includes(hero.category);
type Quote = { amount_rub: number; lines: {slug: string; name: string; amount_rub: number}[] };

export function LeadDialog({ offerings }: { offerings: Offering[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const selection = useSelection(), dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(false);
  const [programSlug, setProgramSlug] = useState(""), [heroSlug, setHeroSlug] = useState("");
  const [tariffCode, setTariffCode] = useState("");
  const [secondPerformer, setSecondPerformer] = useState(false);
  const [addons, setAddons] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null), [quoteError, setQuoteError] = useState("");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const program = offerings.find(item => item.slug === programSlug);
  const availableHeroes = program ? program.characters.filter(ordinaryHero) : [...new Map(offerings.flatMap(item => item.characters).filter(ordinaryHero).map(hero => [hero.slug, hero])).values()];
  const transformer = program?.kind === "transformer";
  const packaged = program?.kind === "package";
  const packageBase = packaged ? basePrice(program) : undefined;
  const secondTariff = packaged ? program.prices.find(price => price.context === "second_performer") : undefined;
  const packageAmount = packageBase === undefined ? undefined : packageBase + (secondPerformer && secondTariff ? secondTariff.amount_rub : 0);
  const availableShows = offerings.filter(item => item.kind === "show" && item.prices.some(price => price.context === "with_animation") && item.prices.some(price => price.context === "transformer_support"));
  useEffect(() => {
    if (selection.open) { setSuccess(false); setError(""); setSecondPerformer(false); setAddons([]); setQuote(null); setProgramSlug(selection.offering); setTariffCode(selection.tariff || ""); setHeroSlug(selection.character); ref.current?.showModal(); }
    else ref.current?.close();
  }, [selection.open, selection.offering, selection.character, selection.tariff]);
  useEffect(() => {
    setQuote(null); setQuoteError("");
    if (!selection.open || !transformer) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ offering: programSlug, addons: addons.join(",") });
    fetch(`/api/v1/transformer-quote/?${params}`, {cache:"no-store", signal:controller.signal})
      .then(async response => { const data = await response.json().catch(() => { throw new Error("Не удалось рассчитать стоимость. Попробуйте выбрать программу ещё раз или позвоните нам."); }); if (!response.ok) throw new Error(data.detail || "Не удалось рассчитать стоимость."); return data as Quote; })
      .then(data => { if (!controller.signal.aborted) setQuote(data); })
      .catch(err => { if (!controller.signal.aborted) setQuoteError(err instanceof Error ? err.message : "Не удалось рассчитать стоимость."); });
    return () => controller.abort();
  }, [selection.open, transformer, programSlug, addons, quoteAttempt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (success) successRef.current?.focus(); }, [success]);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || (transformer && !quote)) return;
    const form = event.currentTarget, data = new FormData(form);
    let requestSent = false;
    setBusy(true); setError("");
    try {
      const csrf = await fetch("/api/v1/csrf/", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!csrf.ok) throw new Error("Сейчас не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.");
      const { csrf_token } = await csrf.json();
      const selectedOffering = offerings.find(item => item.slug === data.get("offering"));
      const compatibleCharacter = availableHeroes.some(item => item.slug === heroSlug) && (!selectedOffering || selectedOffering.characters.some(item => item.slug === heroSlug));
      const payload = {
        name: data.get("name"), phone: data.get("phone"), contact_method: data.get("contact_method"),
        event_date: data.get("event_date") || null, comment: data.get("comment"),
        offering: data.get("offering") || null,
        tariff_code: selectedOffering?.kind === "seasonal" ? tariffCode : "",
        character: compatibleCharacter ? heroSlug || null : null,
        addons: transformer || selectedOffering?.kind === "seasonal" ? addons : [],
        second_performer: !!packaged && secondPerformer && !!secondTariff,
        data_consent: data.get("data_consent") === "on", website: data.get("website") || "",
      };
      requestSent = true;
      const response = await fetch("/api/v1/leads/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf_token }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const field = Object.values(result)[0];
        throw new Error(response.status === 429 ? "Слишком много попыток. Можно связаться с нами по телефону." : typeof field === "string" ? field : Array.isArray(field) ? field.join(" ") : "Не удалось отправить заявку. Проверьте данные и попробуйте снова.");
      }
      setSuccess(true); form.reset();
    } catch (err) {
      const connectionError = err instanceof Error && ["TypeError", "AbortError", "TimeoutError", "SyntaxError"].includes(err.name);
      setError(connectionError
        ? requestSent
          ? "Не удалось получить подтверждение отправки. Заявка могла сохраниться — позвоните нам, чтобы уточнить, прежде чем отправлять её повторно. Ваши данные остались в форме."
          : "Не удалось связаться с сайтом. Проверьте интернет и попробуйте ещё раз или позвоните нам. Ваши данные остались в форме."
        : err instanceof Error ? err.message : "Не удалось отправить заявку. Ваши данные остались в форме.");
    }
    finally { setBusy(false); }
  }
  return <dialog ref={ref} className="lead-dialog" aria-labelledby={success ? "lead-success-title" : "lead-title"} onCancel={event => { if (busy) event.preventDefault(); else dispatch(close()); }} onClick={event => { if (event.target === event.currentTarget && !busy) dispatch(close()); }}>
    <button className="dialog-close" aria-label="Закрыть форму" disabled={busy} onClick={() => dispatch(close())}><X /></button>
    {success ? <div className="form-success"><span><Check /></span><h2 id="lead-success-title" ref={successRef} tabIndex={-1}>Первый шаг к празднику сделан!</h2><p>Заявка сохранена. Обсудим с вами дату, программу и выезд.</p><button className="button orange" onClick={() => dispatch(close())}>Отлично</button></div> : <>
      <span className="eyebrow">Давайте устроим праздник</span><h2 id="lead-title">Расскажите о вашей идее</h2><p className="muted">Поможем выбрать программу и согласуем свободную дату.</p>
      <form onSubmit={submit}>
        <fieldset className="lead-fields" disabled={busy}>
        <div className="form-row"><label>Ваше имя<input name="name" autoComplete="given-name" maxLength={100} placeholder="Как к вам обращаться" /></label><label>Телефон<input name="phone" type="tel" autoComplete="tel" required maxLength={20} placeholder="+7 ___ ___-__-__" /></label></div>
        <div className="form-row"><label>Как связаться<select name="contact_method"><option value="phone">Позвонить</option><option value="telegram">Telegram</option><option value="max">MAX</option></select></label><label>Дата праздника<input name="event_date" type="date" /></label></div>
        <label>{transformer ? "Большой герой и программа" : "Программа"}<select name="offering" value={programSlug} onChange={event => { const slug = event.target.value; setProgramSlug(slug); setSecondPerformer(false); setAddons([]); setQuote(null); const next = offerings.find(item => item.slug === slug); if (next && !next.characters.some(hero => hero.slug === heroSlug && ordinaryHero(hero))) setHeroSlug(""); }}><option value="">Пока не знаю — помогите выбрать</option>{offerings.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
        {transformer && <p className="lead-choice-note"><strong>{program.characters.find(hero => hero.slug === program.slug)?.name || program.name}</strong> + второй герой в обычном костюме. Оба участника уже входят в цену{basePrice(program) ? ` — ${rubles(basePrice(program)!)} за программу` : ""}.<br />Несколько больших героев? Напишите об этом в пожеланиях — состав и цену обсудим отдельно.</p>}
        {availableHeroes.length > 0 && <label>{transformer ? "Второй герой (обычный костюм)" : "Герой анимации"}<select name="character" value={availableHeroes.some(hero => hero.slug === heroSlug) ? heroSlug : ""} onChange={event => setHeroSlug(event.target.value)}><option value="">Согласуем позже</option>{availableHeroes.map(hero => <option key={hero.slug} value={hero.slug}>{hero.name}{hero.availability === "check" ? " — доступность уточним" : ""}</option>)}</select></label>}
        {packaged && <>
          <fieldset className="lead-addons"><legend>Состав команды</legend><p>В базовую цену {program.included_performers === 1 ? "входит один аниматор" : `входят участники команды: ${program.included_performers}`}. Героя выберите выше; пожелания ко второму герою можно написать ниже.</p>{secondTariff ? <label><input type="checkbox" name="second_performer" checked={secondPerformer} onChange={event => setSecondPerformer(event.target.checked)} /><span>Добавить второго аниматора<small>+ {rubles(secondTariff.amount_rub)}</small></span></label> : <p>Дополнительного ведущего и стоимость согласуем отдельно.</p>}</fieldset>
          <div className="lead-quote" aria-live="polite" aria-atomic="true">{packageAmount !== undefined ? <><strong>Предварительно: {rubles(packageAmount)}</strong><ul><li>{program.name}<span>{rubles(packageBase!)}</span></li>{secondPerformer && secondTariff && <li>Второй аниматор<span>{rubles(secondTariff.amount_rub)}</span></li>}</ul></> : <strong>Стоимость уточним</strong>}<p>Состав, итоговую цену, звук и стоимость выезда согласуем до праздника. Фоновая музыка после программы — без ведущего.</p></div>
        </>}
        {transformer && <>
          <fieldset className="lead-addons"><legend>Продолжить праздник шоу</legend><p>Можно выбрать несколько. Доплата включает шоу и участие второго участника команды.</p>{availableShows.map(show => { const amount = show.prices.filter(price => ["with_animation", "transformer_support"].includes(price.context)).reduce((sum,price) => sum + price.amount_rub,0); return <label key={show.slug}><input type="checkbox" checked={addons.includes(show.slug)} onChange={event => { setQuote(null); setAddons(current => event.target.checked ? [...current,show.slug] : current.filter(slug => slug !== show.slug)); }} /><span>{show.name}<small>+ {rubles(amount)}</small></span></label>; })}</fieldset>
          <div className="lead-quote" aria-live="polite" aria-atomic="true">{quote ? <><strong>Предварительно: {rubles(quote.amount_rub)}</strong><ul>{quote.lines.map(line => <li key={line.slug}>{line.name}<span>{rubles(line.amount_rub)}</span></li>)}</ul><p>Состав, итоговую цену и стоимость выезда согласуем с вами до праздника.</p></> : <><p>{quoteError || "Рассчитываем стоимость…"}</p>{quoteError && <button type="button" className="button outline quote-retry" onClick={() => setQuoteAttempt(value => value + 1)}>Повторить расчёт</button>}</>}</div>
        </>}
        {program?.kind === "seasonal" && <label>Формат новогоднего поздравления<select value={tariffCode} onChange={event => setTariffCode(event.target.value)}><option value="">Помогите выбрать</option>{program.prices.map(price => <option key={price.code} value={price.code}>{price.code === "group-with-sound" ? "Час и комплект звука" : `${price.duration_minutes} минут · два героя`} — {rubles(price.amount_rub)}</option>)}</select></label>}
        {program?.kind === "seasonal" && <fieldset className="lead-addons"><legend>Продолжить новогодний праздник</legend><p>Шоу идут после поздравления, с двумя героями. Стоимость согласуем отдельно.</p>{offerings.filter(show => ["nitrogen", "silver", "cotton-candy-show"].includes(show.slug)).map(show => <label key={show.slug}><input type="checkbox" checked={addons.includes(show.slug)} onChange={event => setAddons(current => event.target.checked ? [...current, show.slug] : current.filter(slug => slug !== show.slug))} /><span>{show.name}</span></label>)}</fieldset>}
        <label>Пожелания<textarea name="comment" maxLength={2000} placeholder="Возраст ребёнка, любимый герой, сколько будет гостей…" rows={3} /></label>
        <div className="honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="consent"><input name="data_consent" type="checkbox" required /><span>Согласен на <Link href="/privacy" target="_blank" rel="noopener noreferrer">обработку данных</Link> для связи по заявке</span></label>
        {error && <p ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</p>}
        <button className="button orange form-submit" disabled={busy || (!!transformer && !quote)}>{busy ? "Отправляем…" : "Обсудить мой праздник"}</button>
        <a className="form-phone" href="tel:+79033922229"><Phone size={16} /> Можно просто позвонить: +7 903 392-22-29</a>
        </fieldset>
      </form>
    </>}
  </dialog>;
}
