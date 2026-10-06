import type { Offering } from "@/lib/types";
import { rubles } from "@/lib/types";
import { ChooseButton } from "./choose-button";
import { Clock3, UsersRound, AudioLines } from "lucide-react";

const formats = [
  { code: "minutes-15", title: "Поздравление у ёлки", text: "Встреча, поздравление, стихи по желанию, вручение подарков и фотографии. Без игровой программы." },
  { code: "minutes-30", title: "Новогодние игры", text: "Знакомство и поздравление, 3–4 игры, стихи по желанию, вручение подарков и фотографии." },
  { code: "minutes-50", title: "Путешествие в Великий Устюг за подарками", text: "Полноценная интерактивная сказка: дети становятся участниками приключения, а тематический реквизит помогает погрузиться в историю." },
];
const slots = [["eve-18", "31 декабря · 18:00"], ["eve-20", "31 декабря · 20:00"], ["eve-22", "31 декабря · 22:00"], ["night-00", "1 января · 00:00"], ["night-02", "1 января · 02:00"]];

export function NewYearFormats({ offering }: { offering: Offering }) {
  const group = offering.prices.find(p => p.code === "group-with-sound");
  return <div className="new-year-formats" id="new-year-formats">
    <p>Два героя вместе в каждой программе. Подарки для вручения заранее передают родители. Базовые цены действуют и 31 декабря при начале до 18:00.</p>
    {formats.map(format => {
      const price = offering.prices.find(p => p.code === format.code);
      if (!price) return null;
      const featured = format.code === "minutes-50";
      return <article key={format.code} className={`new-year-format ${featured ? "new-year-format-featured" : ""}`}>
        {featured && <span className="new-year-recommendation">Полная интерактивная сказка</span>}
        <div className="new-year-format-top"><span>{price.duration_minutes} минут · два героя</span><strong>{rubles(price.amount_rub)}</strong></div>
        <h3>{format.title}</h3><p>{format.text}</p>
        <ChooseButton offering="new-year" tariff={price.code} className={featured ? "button orange" : "button outline"}>Выбрать {price.duration_minutes} минут</ChooseButton>
      </article>;
    })}
    {group && <article className="new-year-group">
      <div className="new-year-group-copy">
        <span className="eyebrow">Новый год для всей компании</span>
        <h3>Час новогоднего праздника <em>с профессиональным звуком</em></h3>
        <ul className="new-year-group-tags" aria-label="Где провести праздник">
          {["Детские сады", "Школы", "Дворовые праздники", "Большие компании"].map(label => <li key={label}>{label}</li>)}
        </ul>
        <div className="new-year-group-price"><strong>{rubles(group.amount_rub)}</strong><span>за программу и комплект звука</span></div>
        <p>Дед Мороз и Снегурочка проведут часовую игровую программу с тематическим реквизитом. Мощный звук и микрофоны помогут детям слышать героев и участвовать в играх всей компанией.</p>
        <ChooseButton offering="new-year" tariff={group.code} className="button orange">Обсудить праздник для компании</ChooseButton>
        <p className="new-year-group-note">Для уличного праздника заранее согласуем площадку и погоду. Стоимость выезда уточним отдельно.</p>
      </div>
      <div className="new-year-group-inclusions">
        <span className="eyebrow">Всё это уже в цене</span>
        <ul>
          <li><Clock3 size={22} aria-hidden="true" /><div><strong>{group.duration_minutes} минут программы</strong><span>Новогодние игры и тематический реквизит</span></div></li>
          <li><UsersRound size={22} aria-hidden="true" /><div><strong>Два героя вместе</strong><span>Дед Мороз и Снегурочка</span></div></li>
          <li><AudioLines size={22} aria-hidden="true" /><div><strong>Профессиональный комплект звука</strong><span>JBL PartyBox 1000 · 1000 Вт<br />Два микрофона Shure</span></div></li>
        </ul>
      </div>
    </article>}
    <section className="new-year-evening"><span className="eyebrow">Особенные часы</span><h3>31 декабря и новогодняя ночь</h3><p>Только интерактивная сказка на 50 минут. Время начала точное, по Оренбургу. Свободный выезд и маршрут подтвердим лично — это не календарь бронирования.</p><div className="new-year-slots">{slots.map(([code, label]) => { const price = offering.prices.find(p => p.code === code); return price && <div key={code}><span>{label}</span><strong>{rubles(price.amount_rub)}</strong><ChooseButton offering="new-year" tariff={code} className="button outline">Обсудить это время</ChooseButton></div>; })}</div><p>Последнее начало — 1 января в 02:00. Короткие поздравления и программа для групп в эти часы недоступны.</p></section>
  </div>;
}
