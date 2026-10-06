import { PageIntro } from "@/components/page-intro";
import { OccasionCards } from "@/components/occasion-cards";
import { ChooseButton } from "@/components/choose-button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Праздники для групп в Оренбурге", "Детский сад, выпускной или большое мероприятие: подберём выездную программу, героев и шоу для вашей компании в Оренбурге.", "/holidays");
export default function Holidays() {
  return <main id="main"><PageIntro path="/holidays" breadcrumbLabel="Праздники для групп" eyebrow="Поводов встретиться — много" title="Праздник для всей компании" description="От группы в детском саду до большого события. Подберём игры, героев и шоу под возраст детей, вашу площадку и бюджет." /><section className="container inner-content"><OccasionCards /></section><section className="container final-cta"><div><h2>У вас другой повод?</h2><p>Расскажите, где и для кого собираете праздник.</p></div><ChooseButton>Обсудить мероприятие</ChooseButton></section></main>;
}
