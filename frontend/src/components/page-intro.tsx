import Link from "next/link";
export function PageIntro({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return <div className="container page-intro"><div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>{title}</span></div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>;
}
