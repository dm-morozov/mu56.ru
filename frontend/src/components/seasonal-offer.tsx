import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Offering, rubles } from "@/lib/types";
import { ChooseButton } from "./choose-button";

export function SeasonalOffer({ offering }: { offering?: Offering }) {
  const tariff = offering?.prices.find(price => price.context === "base" && price.duration_minutes === 50);
  if (!offering || offering.availability === "unavailable" || !tariff) return null;
  return <section className="container season-offer" aria-labelledby="season-title">
    <div className="season-photo"><Image src="/media/new-year/duo-studio.jpg" alt="Наши Дед Мороз и Снегурочка в праздничной фотостудии" width={1024} height={1536} sizes="(max-width: 600px) 100vw, 500px" /></div>
    <div className="season-copy">
      <span className="eyebrow">Новый год в Оренбурге</span>
      <h2 id="season-title">Сказка приходит.<br /><em>Прямо к вам.</em></h2>
      <p>Дед Мороз и Снегурочка приедут вместе. Домой, в садик или школу — на вашу площадку.</p>
      <div className="season-price"><strong>{rubles(tariff.amount_rub)}</strong><span>{tariff.duration_minutes} минут · два героя</span></div>
      <p className="season-detail">«Путешествие в Великий Устюг за подарками». Вечером 31 декабря и новогодней ночью — отдельные тарифы. Есть короткие поздравления и отдельная программа со звуком для большой компании.</p>
      <div className="season-actions"><ChooseButton offering={offering.slug} tariff={tariff.code}>Хочу новогоднюю сказку</ChooseButton><Link href="/new-year" className="text-link">Сравнить программы <ArrowUpRight size={17} /></Link></div>
    </div>
  </section>;
}
