import Link from "next/link";
export default function NotFound() { return <main id="main" className="container section empty-search"><span className="eyebrow">404 · Такой страницы нет</span><h1>Праздник найдётся.<br />А эта страница — нет.</h1><p>Посмотрите программы и любимых героев в каталоге.</p><Link href="/characters" className="button orange">Выбрать героя</Link></main>; }
