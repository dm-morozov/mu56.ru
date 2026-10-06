import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import consent from "@/lib/lead-consent.json";

export const metadata = { title: "Согласие на обработку персональных данных", robots: { index: false, follow: false } };

export default function ConsentPage() {
  return <main id="main"><PageIntro path="/consent" title="Согласие на обработку персональных данных" description="Отдельное согласие для отправки заявки на праздник." /><div className="container privacy-copy">
    <p>Редакция от {consent.date}. Версия: {consent.version}.</p>
    <p>Устанавливая отметку в форме и отправляя заявку на mu56.ru, я добровольно даю согласие на обработку моих персональных данных на следующих условиях. Оператор: {consent.operator}, {consent.operator_status} («Мир Улыбок»).</p>
    <h2>Цель обработки</h2><p>{consent.purpose}</p>
    <h2>Какие данные обрабатываются</h2><p>{consent.data}</p>
    <h2>Действия с данными</h2><p>{consent.operations}</p>
    <h2>Срок действия и прекращение обработки</h2><p>{consent.duration}</p>
    <h2>Как отозвать согласие</h2><p>{consent.withdrawal}</p>
    <h2>Связь через мессенджеры</h2><p>{consent.messengers}</p>
    <h2>Границы согласия</h2><p>{consent.exclusions}</p>
    <p>Общие правила описаны в <Link href="/privacy">политике обработки персональных данных</Link>.</p>
  </div></main>;
}
