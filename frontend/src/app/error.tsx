"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="container section"><h1>Не удалось загрузить программы</h1><p>Попробуйте ещё раз или позвоните нам: <a href="tel:+79033922229">+7 903 392-22-29</a>.</p><button className="button orange" onClick={reset}>Попробовать снова</button></main>; }
