"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Phone, X } from "lucide-react";
import { HeroPicker } from "./hero-picker";
import { ProgramPicker } from "./program-picker";
import { ShowAddon } from "./show-addon";
import { PackagePart } from "./package-part";
import { PhoneInput } from "./phone-input";
import { close, useAppDispatch, useSelection } from "./store-provider";
import { Offering, basePrice, duration, rubles, twoPerformerShowPrice } from "@/lib/types";
import { bookingOfferings, type BookingCatalog } from "@/lib/booking-catalog";
import { track, priceBand } from "@/lib/analytics";
import { FormJourney } from "@/lib/form-journey";
import consent from "@/lib/lead-consent.json";

const ordinaryHero = (hero: Offering["characters"][number]) => !["bumblebee", "optimus-prime", "iron-man"].includes(hero.slug) && !["Большие герои", "Новый год"].includes(hero.category);
type Quote = { amount_rub: number; lines: {slug: string; name: string; amount_rub: number}[] };
const eveningSlots: Record<string, string> = {"eve-18":"31 декабря · 18:00", "eve-20":"31 декабря · 20:00", "eve-22":"31 декабря · 22:00", "night-00":"1 января · 00:00", "night-02":"1 января · 02:00"};
const addonOnly = (slug: string) => ["sound", "photographer"].includes(slug);

function openMobileDateTimePicker(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (!window.matchMedia("(max-width: 600px), (pointer: coarse)").matches || typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Keep the native input usable when this browser cannot open its picker.
  }
}

export function LeadDialog({ catalog }: { catalog: BookingCatalog }) {
  const offerings = useMemo(() => bookingOfferings(catalog), [catalog]);
  const ref = useRef<HTMLDialogElement>(null);
  const journey = useRef<FormJourney | null>(null);
  if (!journey.current) journey.current = new FormJourney(track);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const selection = useSelection(), dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(false);
  const [programSlug, setProgramSlug] = useState(""), [heroSlug, setHeroSlug] = useState("");
  const [eventDate, setEventDate] = useState(""), [eventTime, setEventTime] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tariffCode, setTariffCode] = useState("");
  const [secondPerformer, setSecondPerformer] = useState(false);
  const [secondHeroSlug, setSecondHeroSlug] = useState("");
  const [addons, setAddons] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null), [quoteError, setQuoteError] = useState("");
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const program = offerings.find(item => item.slug === programSlug);
  const availableHeroes = program ? program.characters.filter(ordinaryHero) : [...new Map(offerings.flatMap(item => item.characters).filter(ordinaryHero).map(hero => [hero.slug, hero])).values()];
  const transformer = program?.kind === "transformer";
  const animation = program?.kind === "animation";
  const pricedComposition = transformer || animation;
  const packaged = program?.kind === "package";
  const packageBase = packaged ? basePrice(program) : undefined;
  const secondTariff = packaged ? program.prices.find(price => price.context === "second_performer") : undefined;
  const packageAmount = packageBase === undefined ? undefined : packageBase + (secondPerformer && secondTariff ? secondTariff.amount_rub : 0);
  const soundIncluded = program?.slug === "foam" || program?.parts.some(part => part.service_slug === "foam") || addons.includes("foam") || (program?.kind === "seasonal" && tariffCode === "group-with-sound");
  const selectedExtras = offerings.filter(item => addonOnly(item.slug) && addons.includes(item.slug));
  const extraAmount = selectedExtras.reduce((sum, item) => sum + (basePrice(item) ?? 0), 0);
  const extrasKnown = selectedExtras.every(item => basePrice(item) !== undefined);
  const photographer = selectedExtras.find(item => item.slug === "photographer");
  const simpleBase = packaged ? packageAmount : program?.kind === "seasonal" ? program.prices.find(price => price.code === tariffCode)?.amount_rub : program ? basePrice(program) : undefined;
  const seasonalShows = program?.kind === "seasonal" ? offerings.filter(item => item.kind === "show" && addons.includes(item.slug)) : [];
  const seasonalShowAmount = seasonalShows.reduce((sum, show) => sum + (twoPerformerShowPrice(show) ?? 0), 0);
  const showsKnown = seasonalShows.every(show => twoPerformerShowPrice(show) !== undefined);
  const allAddonsPriced = addons.every(slug => addonOnly(slug) || seasonalShows.some(show => show.slug === slug));
  const simpleTotal = simpleBase !== undefined && extrasKnown && showsKnown && allAddonsPriced ? simpleBase + extraAmount + seasonalShowAmount : undefined;
  const eveningSlot = eveningSlots[tariffCode];
  const monthDay = eventDate.slice(5);
  const specialNight = monthDay === "12-31" && (!eventTime || eventTime >= "18:00") || monthDay === "01-01" && (!eventTime || eventTime <= "04:00");
  const expectedDay = tariffCode.startsWith("eve-") ? "12-31" : "01-01";
  const expectedTime = `${tariffCode.slice(-2)}:00`;
  const scheduleError = program?.kind !== "seasonal" ? "" : eveningSlot
    ? monthDay !== expectedDay || eventTime !== expectedTime ? `Укажите дату и точное начало: ${eveningSlot}, по Оренбургу.` : ""
    : specialNight ? "В эти часы выберите вечерний тариф на 50 минут и соответствующее ему точное время. Последнее начало — 1 января в 02:00." : "";
  const availableShows = offerings.filter(item => item.kind === "show" && item.prices.some(price => price.context === "with_animation") && item.prices.some(price => price.context === "transformer_support"));
  useEffect(() => {
    if (selection.open) journey.current?.open({ program: selection.offering || "unknown", hero: selection.character || "unknown", details: !!(selection.offering || selection.character || selection.tariff || selection.addons?.length) });
    else journey.current?.close("close");
  }, [selection.open]);
  useEffect(() => {
    journey.current?.update({ program: programSlug || "unknown", hero: heroSlug || "unknown", kind: program?.kind || "unknown", addon_count: addons.length, price_band: priceBand(pricedComposition ? quote ? quote.amount_rub + extraAmount : undefined : simpleTotal) });
  }, [programSlug, heroSlug, program?.kind, addons.length, quote, extraAmount, pricedComposition, simpleTotal]);
  useEffect(() => {
    const hide = () => journey.current?.close("pagehide");
    const show = () => { if (ref.current?.open) journey.current?.resume(); };
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    return () => { window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show); };
  }, []);
  function fieldName(target: EventTarget) {
    const el = target as HTMLInputElement;
    return el.name || (el.closest?.(".hero-picker") ? "hero" : el.type === "checkbox" && el.closest?.(".lead-addons") ? "addons" : el.tagName === "SELECT" ? "tariff" : "unknown");
  }
  function changed(event: React.FormEvent<HTMLFormElement>) {
    const el = event.target as HTMLInputElement;
    journey.current?.change(fieldName(el), el.name === "phone" && el.value.replace(/\D/g, "").length === 11 && el.validity.valid);
  }
  useEffect(() => {
    if (selection.open) { setEventDate(""); setEventTime(""); setDetailsOpen(!!(selection.offering || selection.character || selection.tariff || selection.addons?.length)); setSuccess(false); setError(""); setSecondPerformer(false); setSecondHeroSlug(""); setAddons(addonOnly(selection.offering) ? [...new Set([...(selection.addons || []), selection.offering])] : selection.addons || []); setQuote(null); setProgramSlug(addonOnly(selection.offering) ? "animation" : selection.offering); setTariffCode(selection.tariff || ""); setHeroSlug(selection.character); ref.current?.showModal(); }
    else ref.current?.close();
  }, [selection.open, selection.offering, selection.character, selection.tariff, selection.addons]);
  useEffect(() => {
    setQuote(null); setQuoteError("");
    if (!selection.open || !pricedComposition) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ offering: programSlug, addons: addons.filter(slug => slug !== "photographer").join(",") });
    fetch(`/api/v1/${animation ? "animation" : "transformer"}-quote/?${params}`, {cache:"no-store", signal:controller.signal})
      .then(async response => { const data = await response.json().catch(() => { throw new Error("Не удалось рассчитать стоимость. Попробуйте выбрать программу ещё раз или позвоните нам."); }); if (!response.ok) throw new Error(data.detail || "Не удалось рассчитать стоимость."); return data as Quote; })
      .then(data => { if (!controller.signal.aborted) setQuote(data); })
      .catch(err => { if (!controller.signal.aborted) setQuoteError(err instanceof Error ? err.message : "Не удалось рассчитать стоимость."); });
    return () => controller.abort();
  }, [selection.open, pricedComposition, animation, programSlug, addons, quoteAttempt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    setAddons(current => soundIncluded
      ? current.includes("sound") ? current.filter(slug => slug !== "sound") : current
      : selection.soundRequired && !current.includes("sound") ? [...current, "sound"] : current);
  }, [soundIncluded, selection.soundRequired, addons]);
  useEffect(() => { if (success) successRef.current?.focus(); }, [success]);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || scheduleError || (pricedComposition && !quote)) return;
    const form = event.currentTarget, data = new FormData(form);
    journey.current?.submit();
    let failureReason = "unknown", failureStatus = 0;
    let requestSent = false;
    setBusy(true); setError("");
    try {
      const csrf = await fetch("/api/v1/csrf/", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!csrf.ok) { failureReason = "csrf"; failureStatus = csrf.status; }
      if (!csrf.ok) throw new Error("Сейчас не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.");
      const { csrf_token } = await csrf.json();
      const selectedOffering = offerings.find(item => item.slug === data.get("offering"));
      const compatibleCharacter = availableHeroes.some(item => item.slug === heroSlug) && (!selectedOffering || selectedOffering.characters.some(item => item.slug === heroSlug));
      const payload = {
        name: data.get("name"), phone: data.get("phone"), contact_method: data.get("contact_method"),
        event_date: data.get("event_date") || null, event_time: data.get("event_time") || null, comment: data.get("comment"),
        offering: data.get("offering") || null,
        tariff_code: selectedOffering?.kind === "seasonal" ? tariffCode : "",
        character: compatibleCharacter ? heroSlug || null : null,
        addons: selectedOffering ? addons : [],
        second_performer: !!packaged && secondPerformer && !!secondTariff,
        second_character: packaged && secondPerformer && secondTariff && availableHeroes.some(hero => hero.slug === secondHeroSlug) ? secondHeroSlug || null : null,
        data_consent: data.get("data_consent") === "on", consent_version: consent.version, website: data.get("website") || "",
      };
      requestSent = true;
      const response = await fetch("/api/v1/leads/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf_token }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        failureStatus = response.status; failureReason = response.status === 429 ? "rate_limit" : response.status >= 500 ? "server" : "validation";
        const result = await response.json().catch(() => ({}));
        const field = Object.values(result)[0];
        throw new Error(response.status === 429 ? "Слишком много попыток. Можно связаться с нами по телефону." : typeof field === "string" ? field : Array.isArray(field) ? field.join(" ") : "Не удалось отправить заявку. Проверьте данные и попробуйте снова.");
      }
      journey.current?.success(); setSuccess(true); form.reset();
    } catch (err) {
      journey.current?.error(err instanceof Error && ["AbortError", "TimeoutError"].includes(err.name) ? "timeout" : err instanceof Error && err.name === "TypeError" ? "network" : failureReason, failureStatus);
      const connectionError = err instanceof Error && ["TypeError", "AbortError", "TimeoutError", "SyntaxError"].includes(err.name);
      setError(connectionError
        ? requestSent
          ? "Не удалось получить подтверждение отправки. Заявка могла сохраниться — позвоните нам, чтобы уточнить, прежде чем отправлять её повторно. Ваши данные остались в форме."
          : "Не удалось связаться с сайтом. Проверьте интернет и попробуйте ещё раз или позвоните нам. Ваши данные остались в форме."
        : err instanceof Error ? err.message : "Не удалось отправить заявку. Ваши данные остались в форме.");
    }
    finally { setBusy(false); }
  }
  return <dialog ref={ref} className="lead-dialog" aria-labelledby={success ? "lead-success-title" : "lead-title"} onCancel={event => { if (busy) event.preventDefault(); else dispatch(close()); }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dispatch(close());
  }}>
    <button className="dialog-close" aria-label="Закрыть форму" disabled={busy} onClick={() => dispatch(close())}><X /></button>
    {success ? <div className="form-success"><span><Check /></span><h2 id="lead-success-title" ref={successRef} tabIndex={-1}>Первый шаг к празднику сделан!</h2><p>Заявка сохранена. Обсудим с вами дату, программу и выезд.</p><button className="button orange" onClick={() => dispatch(close())}>Отлично</button></div> : <>
      <span className="eyebrow">Давайте устроим праздник</span><h2 id="lead-title">Расскажите о вашей идее</h2><p className="muted">{detailsOpen ? "Выберите состав праздника. Дату и детали согласуем с вами." : "Оставьте телефон — поможем выбрать программу. Дату и героя можно решить вместе."}</p>
      <form className="ym-disable-keys" onSubmit={submit} onChange={changed} onFocusCapture={event => journey.current?.focus(fieldName(event.target))} onInvalidCapture={event => journey.current?.invalid(fieldName(event.target))}>
        <fieldset className="lead-fields" disabled={busy}>
        <div className="form-row"><label>Ваше имя<input name="name" autoComplete="given-name" maxLength={100} placeholder="Как к вам обращаться" /></label><label>Телефон<PhoneInput /></label></div>
        <label>Как связаться<select name="contact_method"><option value="phone">Позвонить</option><option value="telegram">Telegram</option><option value="max">MAX</option></select></label>
        <button type="button" className="lead-details-toggle" aria-expanded={detailsOpen} aria-controls="lead-program-details" onClick={() => { if (!detailsOpen) track("details_open"); journey.current?.change("details"); setDetailsOpen(value => !value); }}><span>{detailsOpen ? "Свернуть детали праздника" : "Указать дату и выбрать программу"}<small>{detailsOpen ? "Ваш выбор сохранится в заявке" : "Необязательно — можно обсудить с нами"}</small></span><span aria-hidden="true">{detailsOpen ? "−" : "+"}</span></button>
        {!detailsOpen && program && <p className="lead-selection-summary">Выбрано: {program.name}{heroSlug ? ` · ${availableHeroes.find(hero => hero.slug === heroSlug)?.name || "герой выбран"}` : ""}{addons.length ? ` · дополнений: ${addons.length}` : ""}. Детали сохранены.</p>}
        <div id="lead-program-details" hidden={!detailsOpen}>
        <div className="form-row"><label>Дата праздника<input name="event_date" type="date" value={eventDate} onClick={openMobileDateTimePicker} onInput={event => setEventDate(event.currentTarget.value)} onChange={event => setEventDate(event.target.value)} /></label><label>Время начала программы<input name="event_time" type="time" value={eventTime} onClick={openMobileDateTimePicker} onInput={event => setEventTime(event.currentTarget.value)} onChange={event => setEventTime(event.target.value)} aria-describedby="event-time-help" /></label></div>
        <p id="event-time-help" className="hero-picker-help event-time-help">Время по Оренбургу. Начало программы лучше планировать на 15 минут позже сбора гостей.</p>
        <ProgramPicker offerings={offerings} value={programSlug} label={transformer ? "Большой герой и программа" : "Программа"} onChange={slug => { track("program_select", {program: slug || "unknown"}); journey.current?.change("offering"); setProgramSlug(slug); setSecondPerformer(false); setSecondHeroSlug(""); setAddons([]); setQuote(null); const next = offerings.find(item => item.slug === slug); if (next && !next.characters.some(hero => hero.slug === heroSlug && ordinaryHero(hero))) setHeroSlug(""); }} />
        {packaged && <section className="lead-package" aria-labelledby="lead-package-title">
          <h3 id="lead-package-title">{program.name}<span>{packageBase === undefined ? "Стоимость уточним" : rubles(packageBase)}</span></h3>
          <fieldset className="lead-addons package-inclusions" aria-labelledby="package-inclusions-title"><h4 id="package-inclusions-title">В программу входит</h4><p>Все пункты включены в пакет. Чтобы изменить состав, выберите другую программу.</p>{program.parts.map(part => <PackagePart key={`${program.slug}-${part.position}`} part={part} description={!part.led_by_performer ? "После анимации и шоу колонка продолжает играть фоновую музыку, пока аниматоры собирают всё оборудование на вашем празднике. Колонку забирают в последнюю очередь, когда остальное оборудование уже сложено. В это время ведущие не проводят игры, конкурсы и шоу." : offerings.find(item => item.slug === part.service_slug)?.description} />)}</fieldset>
          <p className="hero-picker-help">{soundIncluded ? "Комплект звука уже включён в программу. Стоимость выезда согласуем отдельно." : addons.includes("sound") ? "Комплект звука выбран и учтён в итоговой стоимости. Стоимость выезда согласуем отдельно." : "Звук и стоимость выезда согласуем отдельно до праздника."}</p>
        </section>}
        {availableHeroes.length > 0 && <HeroPicker key={`${selection.open}-${programSlug}`} heroes={availableHeroes} value={heroSlug} onChange={slug => { track("hero_select", {hero: slug || "unknown"}); journey.current?.change("hero"); setHeroSlug(slug); }} label={transformer ? "Второй герой" : "Герой анимации"} />}
        {transformer && <p className="lead-choice-note"><strong>{program.characters.find(hero => hero.slug === program.slug)?.name || program.name}</strong> + второй герой. Оба входят в цену{basePrice(program) ? ` — ${rubles(basePrice(program)!)} за программу` : ""}.<br />Хотите двух трансформеров? Напишите в пожеланиях — цену обсудим.</p>}
        {packaged && <>
          <fieldset className="lead-addons"><legend>Состав команды</legend><p>В базовую цену {program.included_performers === 1 ? "входит один аниматор" : `входят участники команды: ${program.included_performers}`}. Первого героя выберите выше. Второй аниматор участвует в анимации и шоу; фоновая музыка в конце — без ведущих.</p>{secondTariff ? <label><input type="checkbox" name="second_performer" checked={secondPerformer} onChange={event => { setSecondPerformer(event.target.checked); setSecondHeroSlug(""); }} /><span>Добавить второго аниматора на всю программу<small>+ {rubles(secondTariff.amount_rub)}</small></span></label> : <p>Дополнительного ведущего и стоимость согласуем отдельно.</p>}</fieldset>
          {secondPerformer && secondTariff && <HeroPicker heroes={availableHeroes} value={secondHeroSlug} onChange={slug => { track("hero_select", {hero: slug || "unknown", field: "second_hero"}); journey.current?.change("second_hero"); setSecondHeroSlug(slug); }} label="Второй герой" />}

        </>}
        {pricedComposition && <>
          <fieldset className="lead-addons"><legend>Добавить шоу</legend><p>Можно выбрать несколько. {transformer ? "Шоу ведут два аниматора в специальных костюмах. Их работа включена в доплату." : "Шоу продлевают праздник. Анимация оплачивается один раз."}</p>{animation && addons.includes("foam") && <p>Комплект звука уже включён в пенную вечеринку.</p>}{(animation ? offerings.filter(item => item.kind === "show") : availableShows).map(show => { const amount = show.slug === "sound" ? basePrice(show) : animation ? (show.prices.find(price => price.context === "with_animation")?.amount_rub ?? basePrice(show)) : show.prices.filter(price => ["with_animation", "transformer_support"].includes(price.context)).reduce((sum,price) => sum + price.amount_rub,0); return <ShowAddon key={`${programSlug}-${show.slug}`} show={show} checked={addons.includes(show.slug)} onChange={checked => { setQuote(null); setAddons(current => checked ? [...current.filter(slug => show.slug !== "foam" || slug !== "sound"),show.slug] : current.filter(slug => slug !== show.slug)); }} performers={transformer && show.kind === "show" ? 2 : undefined} price={`${amount === undefined ? "Цену уточним" : `+ ${rubles(amount)}`}`} />; })}</fieldset>

        </>}
        {program?.kind === "seasonal" && <label>Формат новогоднего поздравления<select value={tariffCode} onChange={event => { setTariffCode(event.target.value); if (eveningSlots[event.target.value]) setAddons(current => current.filter(addonOnly)); }}><option value="">Помогите выбрать</option>{program.prices.map(price => <option key={price.code} value={price.code}>{eveningSlots[price.code] ? `${eveningSlots[price.code]} · 50 минут` : price.code === "group-with-sound" ? "Час и комплект звука" : `${price.duration_minutes} минут · два героя`} — {rubles(price.amount_rub)}</option>)}</select></label>}
        {program?.kind === "seasonal" && <p className="hero-picker-help">Подарки передают родители. 31 декабря с 18:00 и новогодней ночью — только сказка на 50 минут по точным часам. Для вечернего тарифа укажите дату и время начала, соответствующие его названию. Свободный выезд подтвердим лично.</p>}
        {program?.kind === "seasonal" && !eveningSlot && <fieldset className="lead-addons"><legend>Продолжить новогодний праздник</legend><p>После поздравления оба аниматора переодеваются в специальные костюмы и проводят выбранное шоу вдвоём. Работа двух аниматоров включена в доплату.</p>{offerings.filter(show => ["nitrogen", "silver", "cotton-candy-show"].includes(show.slug)).map(show => <ShowAddon key={`${programSlug}-${show.slug}`} show={show} performers={2} price={twoPerformerShowPrice(show) === undefined ? "Цену уточним" : `+ ${rubles(twoPerformerShowPrice(show)!)}`} checked={addons.includes(show.slug)} onChange={checked => setAddons(current => checked ? [...current, show.slug] : current.filter(slug => slug !== show.slug))} />)}</fieldset>}
        {program?.kind === "show" && <p className="hero-picker-help">Анимация в этот вариант не входит. Если нужен герой и игры, выберите программу «Аниматор на праздник» и отметьте шоу.</p>}
        {program && <fieldset className="lead-addons"><legend>Дополнения к программе</legend>{selection.soundRequired && <p>Для этого формата праздника комплект звука обязателен и учтён в расчёте.</p>}{offerings.filter(item => addonOnly(item.slug)).map(item => <ShowAddon key={`${programSlug}-${item.slug}`} show={item} checked={item.slug === "sound" && soundIncluded || addons.includes(item.slug)} disabled={item.slug === "sound" && (soundIncluded || selection.soundRequired)} price={item.slug === "sound" && soundIncluded ? "Уже включён в программу" : basePrice(item) === undefined ? "Стоимость согласуем" : `+ ${rubles(basePrice(item)!)}${item.slug === "photographer" && item.duration_minutes ? ` / ${duration(item.duration_minutes)}` : ""}`} onChange={checked => { setQuote(null); setAddons(current => checked ? [...current, item.slug] : current.filter(slug => slug !== item.slug)); }} />)}</fieldset>}
        </div>
        {pricedComposition && <div className="lead-quote" aria-live="polite" aria-atomic="true">{quote ? <><strong>{extrasKnown ? `Предварительно: ${rubles(quote.amount_rub + (photographer ? basePrice(photographer)! : 0))}` : "Стоимость с фотографом уточним"}</strong><ul>{quote.lines.map(line => {
            const item = offerings.find(offering => offering.slug === line.slug);
            const timedProgram = transformer && item && ["transformer", "show"].includes(item.kind);
            return <li key={line.slug}><span className="lead-quote-copy"><span>{line.name}</span>{line.slug === "sound" && <small>JBL PartyBox 1000 · 1000 Вт · 2 микрофона Shure</small>}{timedProgram && <small>{item.duration_is_approximate ? "≈ " : ""}{duration(item.duration_minutes)} · 2 {item.kind === "transformer" ? "героя" : "аниматора"}</small>}</span><span className="lead-quote-amount">{rubles(line.amount_rub)}</span></li>;
          })}{photographer && <li><span>{photographer.name}</span><span>{basePrice(photographer) === undefined ? "Цену уточним" : rubles(basePrice(photographer)!)}</span></li>}</ul><p className="lead-travel-note"><strong>Выезд на вашу площадку</strong><span>Итоговую цену и выезд согласуем до праздника.</span></p></> : <><p>{quoteError || "Рассчитываем стоимость…"}</p>{quoteError && <button type="button" className="button outline quote-retry" onClick={() => setQuoteAttempt(value => value + 1)}>Повторить расчёт</button>}</>}</div>}
        {scheduleError && <p className="form-error" role="status">{scheduleError}{!detailsOpen && " Разверните детали праздника, чтобы изменить выбор."}</p>}
        {program && !scheduleError && !pricedComposition && (packaged || program.kind === "seasonal" || program.kind === "show" || selectedExtras.length > 0 || secondPerformer) && <div className="lead-quote" aria-live="polite"><strong>{simpleTotal === undefined ? "Итоговую стоимость согласуем" : `Всего за программу: ${rubles(simpleTotal)}`}</strong><ul><li>{program.name}<span>{(packaged ? packageBase : simpleBase) === undefined ? "Цену уточним" : rubles((packaged ? packageBase : simpleBase)!)}</span></li>{seasonalShows.map(show => <li key={show.slug}><span className="lead-quote-copy"><span>{show.name}</span><small>{show.duration_is_approximate ? "≈ " : ""}{duration(show.duration_minutes)} · 2 аниматора</small></span><span>{twoPerformerShowPrice(show) === undefined ? "Цену уточним" : rubles(twoPerformerShowPrice(show)!)}</span></li>)}{packaged && program.parts.map(part => <li key={`included-${part.position}`}><span className="lead-quote-copy"><span>{part.title}</span><small>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</small></span><span className="lead-quote-amount">Включено</span></li>)}{packaged && soundIncluded && <li><span className="lead-quote-copy"><span>Много звука</span><small>JBL PartyBox 1000 · 1000 Вт · 2 микрофона Shure</small></span><span>Включено</span></li>}{secondPerformer && secondTariff && <li>Второй аниматор на всю программу<span>{rubles(secondTariff.amount_rub)}</span></li>}{selectedExtras.map(item => <li key={item.slug}><span className="lead-quote-copy"><span>{item.name}</span>{item.slug === "sound" && <small>JBL PartyBox 1000 · 1000 Вт · 2 микрофона Shure</small>}</span><span>{basePrice(item) === undefined ? "Цену уточним" : rubles(basePrice(item)!)}</span></li>)}</ul>{secondPerformer && <p>В стоимость программы включён второй аниматор.</p>}<p className="lead-travel-note"><strong>Выезд на вашу площадку</strong><span>Стоимость выезда согласуем отдельно.</span></p></div>}
        <label>Пожелания <span className="field-optional">(необязательно)</span><textarea name="comment" maxLength={2000} placeholder="Возраст ребёнка, любимый герой, сколько будет гостей…" rows={3} /></label>
        <div className="honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="consent"><input name="data_consent" type="checkbox" required /><span>Даю <Link href="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</Link> для рассмотрения заявки и связи со мной. <Link href="/privacy" target="_blank" rel="noopener noreferrer">Политика обработки данных</Link>.</span></label>
        {error && <p ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</p>}
        <button className="button orange form-submit" disabled={busy || !!scheduleError || (!!pricedComposition && !quote)}>{busy ? "Отправляем…" : "Обсудить мой праздник"}</button>
        <a className="form-phone" href="tel:+79033922229"><Phone size={16} /> Можно просто позвонить: +7 903 392-22-29</a>
        </fieldset>
      </form>
    </>}
  </dialog>;
}
