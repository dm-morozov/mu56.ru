import { PageIntro } from "@/components/page-intro";
import Image from "next/image";
import { ChooseButton } from "@/components/choose-button";
import { messengers, socialProfiles } from "@/lib/contacts";
export const metadata = { title: "Контакты", description: "Свяжитесь с «Миром Улыбок» в Оренбурге: телефон, Telegram и MAX. Обсудим дату, выезд, персонажей и программу детского праздника.", alternates: { canonical: "/contacts" } };
export default function ContactsPage() {
  return <main id="main">
    <PageIntro path="/contacts" breadcrumbLabel="Контакты" title="Контакты «Мира Улыбок»" eyebrow="Давайте устроим праздник" description="Позвоните, напишите в Telegram или MAX, оставьте заявку. Обсудим идеи, свободную дату и выезд на вашу площадку." />
    <section className="container inner-content">
      <div className="contact-panel">
        <div>
          <div className="contact-person">
            <div className="contact-avatar"><Image src="/media/dmitry-morozov-avatar.webp" width={88} height={88} sizes="(max-width: 600px) 92px, 146px" alt="Дмитрий Морозов, основатель «Мира Улыбок»" /></div>
            <div>
              <strong className="contact-person-name">Дмитрий Морозов</strong>
              <span className="contact-person-role">Основатель «Мира Улыбок»</span>
              <a className="contact-number" href="tel:+79033922229">+7 903 392-22-29</a>
            </div>
          </div>
          <p><strong>На связи ежедневно, 10:00–20:00.</strong><br />Время по Оренбургу, без выходных.</p>
          <div className="contact-channels">{messengers.map(item => <a key={item.name} className="button outline" href={item.href} target="_blank" rel="noopener noreferrer">Написать в {item.name} ↗</a>)}</div>
          <h2 className="contact-social-title">Больше наших праздников</h2>
          <div className="contact-channels">{socialProfiles.map(item => <a key={item.name} className="text-link" href={item.href} target="_blank" rel="noopener noreferrer">{item.name} ↗</a>)}</div>
          <p className="contact-travel">Работаем на выезде: дома, в кафе, детском саду, школе или на улице. Условия площадки и стоимость дороги для удалённых районов согласуем отдельно.</p>
          <h2 className="contact-social-title">Площадка нашего партнёра</h2>
          <p>Проводим праздники и в Кондитерском доме «Винни-Пух»: Оренбург, ул. Ульянова, 81. Дату, программу и условия проведения на этой площадке согласуем заранее.</p>
          <a className="text-link" href="https://yandex.ru/maps/org/mir_ulybok/170646325221/" target="_blank" rel="noopener noreferrer">Посмотреть на карте ↗</a>
        </div>
        <div className="contact-introduction">
          <span className="eyebrow">Давайте знакомиться</span>
          <h2>Праздники — моё дело с 2008 года</h2>
          <p>Я Дмитрий, основатель «Мира Улыбок». Лично провёл более 15 тысяч праздников. Сегодня вместе с командой подбираем героев и программу под возраст, интересы ребёнка и вашу компанию гостей.</p>
          <p className="contact-guarantee"><strong>Оплата после праздника.</strong><br />Не понравится — можете не платить.</p>
          <p>Расскажите о вашей идее — поможем выбрать подходящий формат.</p>
          <ChooseButton>Подобрать мой праздник</ChooseButton>
        </div>
      </div>
    </section>
  </main>;
}
