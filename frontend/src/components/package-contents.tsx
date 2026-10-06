import { Info } from "lucide-react";
import type { Offering, Part } from "@/lib/types";

const backgroundDescription = "После игр и шоу музыка продолжает играть, пока команда собирает оборудование. На этом этапе аниматоры уже не проводят программу.";

export function PackageContents({ parts, offerings }: { parts: Part[]; offerings: Offering[] }) {
  return <ul className="package-contents">{parts.map(part => {
    const title = part.led_by_performer ? part.title.replace("Аниматор на праздник", "Анимация с любимым героем") : "Фоновая музыка — без ведущего";
    const description = part.led_by_performer ? offerings.find(item => item.slug === part.service_slug)?.description : backgroundDescription;
    const row = <><span className="package-part-title">{title}</span><small>{part.is_approximate ? "≈ " : ""}{part.duration_minutes} мин</small></>;
    return <li key={part.position}>{description ? <details className="package-part-details"><summary>{row}<span className="package-part-info"><Info size={18} aria-hidden="true" /><span className="sr-only">Подробнее об этапе</span></span></summary><p>{description}</p></details> : <div className="package-part-row">{row}</div>}</li>;
  })}</ul>;
}
