import Image from "next/image";
import { Character, Offering, basePrice, duration, rubles } from "@/lib/types";
import { showImage } from "@/lib/images";
import { ChooseButton } from "./choose-button";

export function ProgramExtras({ offering, offerings, character }: { offering: Offering; offerings: Offering[]; character?: Character }) {
  const base = basePrice(offering);
  const transformer = offering.kind === "transformer";
  return <>
    <div className="transformer-extra-list">{["nitrogen", "silver", "cotton-candy-show"].map(slug => {
      const show = offerings.find(item => item.slug === slug);
      const addon = show?.prices.find(price => price.context === "with_animation");
      const support = show?.prices.find(price => price.context === "transformer_support");
      if (!show || !addon || base === undefined || (transformer && !support)) return null;
      const extra = addon.amount_rub + (transformer ? support!.amount_rub : 0);
      return <ChooseButton key={slug} offering={offering.slug} character={character?.slug} addons={[slug]} className="transformer-extra">
        <span className={`transformer-extra-photo show-visual-${slug}`}><Image src={showImage(slug)!} alt="" width={640} height={430} sizes="(max-width:600px) 100vw, 33vw" /></span>
        <span className="transformer-extra-copy"><strong>{show.name}</strong>
          <span>+ {show.duration_is_approximate ? "≈ " : ""}{duration(show.duration_minutes)} к празднику · {transformer ? "2 аниматора" : "1 аниматор"}</span>
          <span className="transformer-extra-prices"><span>Доплата <b>+ {rubles(extra)}</b></span><span>{transformer ? "Трансформеры + шоу" : "Анимация + шоу"} — всего <b>{rubles(base + extra)}</b></span></span>
          <span className="transformer-extra-action">Выбрать шоу в конструкторе</span>
        </span>
      </ChooseButton>;
    })}</div>
    <div className="program-constructor"><span><strong>Соберите свой праздник</strong><span>Можно выбрать несколько шоу и дополнения. Стоимость покажем сразу.</span></span><ChooseButton offering={offering.slug} character={character?.slug} className="button outline">Открыть конструктор</ChooseButton></div>
  </>;
}
