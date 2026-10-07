import { AnalyticsSettingsButton } from "./site-analytics";
import Link from "next/link";
import { messengers, socialProfiles } from "@/lib/contacts";
import { Brand } from "./brand";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return <footer className="footer"><div className="container"><div className="footer-main"><div><Link href="/" className="brand"><Brand /></Link><p>Детство — время больших впечатлений.<br />А мы помогаем им случиться.</p><span>Выездные праздники в Оренбурге</span></div><div><h3>Выбрать праздник</h3><Link href="/animators">Аниматоры в Оренбурге</Link><Link href="/transformers">Трансформеры</Link><Link href="/packages">Пакеты праздников</Link><Link href="/characters">Все персонажи</Link><Link href="/shows">Услуги</Link><Link href="/holidays">Праздники для групп</Link></div><div><h3>Больше о нас</h3><Link href="/gallery">Фото праздников</Link><Link href="/reviews">Отзывы родителей</Link><Link href="/articles">Идеи для праздника</Link><Link href="/extras">Дополнения</Link><Link href="/new-year">Новый год</Link><Link href="/contacts">Контакты</Link></div><div className="footer-contact"><h3>Давайте знакомиться</h3><a href="tel:+79033922229">+7 903 392-22-29</a>{messengers.map(item => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="telegram-link">Написать в {item.name} <ArrowUpRight size={17} /></a>)}<div className="footer-socials">{socialProfiles.map(item => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer">{item.name} ↗</a>)}</div><p>Дату и стоимость выезда<br />согласуем по вашему адресу.</p></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Мир Улыбок</span><Link href="/privacy">Политика обработки данных</Link><AnalyticsSettingsButton /><span>Сделано для счастливых воспоминаний</span></div></div></footer>;
}

