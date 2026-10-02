import Link from "next/link";
import { Brand } from "./brand";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return <footer className="footer"><div className="container"><div className="footer-main"><div><Link href="/" className="brand"><Brand /></Link><p>Детство — время больших впечатлений.<br />А мы помогаем им случиться.</p><span>Выездные праздники в Оренбурге</span></div><div><h3>Выбрать праздник</h3><Link href="/animators">Аниматоры в Оренбурге</Link><Link href="/transformers">Трансформеры</Link><Link href="/packages">Пакеты праздников</Link><Link href="/characters">Все персонажи</Link><Link href="/shows">Шоу и программы</Link><Link href="/holidays">Праздники для групп</Link></div><div><h3>Больше о нас</h3><Link href="/gallery">Фото праздников</Link><Link href="/reviews">Отзывы родителей</Link><Link href="/articles">Идеи для праздника</Link><Link href="/extras">Дополнения</Link><Link href="/new-year">Новый год</Link><Link href="/contacts">Контакты</Link></div><div className="footer-contact"><h3>Давайте знакомиться</h3><a href="tel:+79033922229">+7 903 392-22-29</a><a href="https://t.me/dem2014" target="_blank" rel="noopener noreferrer" className="telegram-link">Написать в Telegram <ArrowUpRight size={17} /></a><p>Дату и стоимость выезда<br />согласуем по вашему адресу.</p></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Мир Улыбок</span><Link href="/privacy">Обработка данных</Link><span>Сделано для счастливых воспоминаний</span></div></div></footer>;
}

