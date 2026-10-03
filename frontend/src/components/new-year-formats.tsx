import type { Offering } from "@/lib/types";
import { rubles } from "@/lib/types";
import { ChooseButton } from "./choose-button";

const formats = [
  { code: "minutes-30", title: "Встреча с новогодней сказкой", text: "Короткий формат поздравления — когда хочется встретить любимых героев и сохранить праздничное настроение." },
  { code: "minutes-40", title: "Больше времени для праздника", text: "Поздравление без спешки: выбирайте, если хотите провести с Дедом Морозом и Снегурочкой немного больше времени." },
  { code: "minutes-55", title: "Полная новогодняя сказка", text: "В этом формате сюжет раскрывается полностью. Больше времени, чтобы погрузиться в сказку вместе с обоими героями." },
];

export function NewYearFormats({ offering }: { offering: Offering }) {
  const group = offering.prices.find(p => p.code === "group-with-sound");
  return <div className="new-year-formats">
    <p>Дед Мороз и Снегурочка вместе в каждом варианте. Выберите, сколько времени провести в сказке.</p>
    {formats.map(format => {
      const price = offering.prices.find(p => p.code === format.code);
      if (!price) return null;
      const featured = format.code === "minutes-55";
      return <article key={format.code} className={`new-year-format ${featured ? "new-year-format-featured" : ""}`}>
        {featured && <span className="new-year-recommendation">Рекомендуем для полной программы</span>}
        <div className="new-year-format-top"><span>{price.duration_minutes} минут · два героя</span><strong>{rubles(price.amount_rub)}</strong></div>
        <h3>{format.title}</h3><p>{format.text}</p>
        <ChooseButton offering="new-year" tariff={price.code} className={featured ? "button orange" : "button outline"}>Выбрать {price.duration_minutes} минут</ChooseButton>
      </article>;
    })}
    {group && <article className="new-year-group"><span className="eyebrow">Для большой компании</span><h3>Час праздника и комплект звука</h3><p>Два героя, JBL PartyBox 1000 и два микрофона Shure. Для сада, школы и других больших мероприятий — программу подбираем под площадку и гостей.</p><strong>{rubles(group.amount_rub)}</strong><ChooseButton offering="new-year" tariff={group.code} className="button outline">Обсудить праздник для группы</ChooseButton></article>}
  </div>;
}
