import { Breadcrumbs, type Breadcrumb } from "./breadcrumbs";
export function PageIntro({ title, description, eyebrow, path, breadcrumbLabel = title, parents }: { title: string; description: string; eyebrow?: string; path: string; breadcrumbLabel?: string; parents?: Breadcrumb[] }) {
  return <div className="container page-intro"><Breadcrumbs current={{ label: breadcrumbLabel, href: path }} parents={parents} />{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>;
}
