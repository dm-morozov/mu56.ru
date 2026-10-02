import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { occasions } from "@/lib/occasions";

export function OccasionCards() {
  return <div className="occasion-grid">{occasions.map(item => <Link className="occasion-card" href={`/holidays/${item.slug}`} key={item.slug}>
    <Image src={item.image} alt={item.imageAlt} width={600} height={450} sizes="(max-width: 700px) 100vw, 420px" />
    <div><span className="eyebrow">{item.eyebrow}</span><h3>{item.shortTitle}<ArrowUpRight size={22} /></h3><p>{item.points[0]}</p></div>
  </Link>)}</div>;
}
