import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { StructuredData } from "./structured-data";

export type Breadcrumb = { label: string; href: string };

export function Breadcrumbs({ current, parents = [] }: { current: Breadcrumb; parents?: Breadcrumb[] }) {
  const items = [{ label: "Главная", href: "/" }, ...parents, current];
  return <>
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      {items.map((item, index) => <span className="breadcrumb-item" key={item.href}>
        {index > 0 && <span aria-hidden="true">/</span>}
        {index === items.length - 1 ? <span aria-current="page">{item.label}</span> : <Link href={item.href}>{item.label}</Link>}
      </span>)}
    </nav>
    <StructuredData data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: absoluteUrl(item.href) })) }} />
  </>;
}
