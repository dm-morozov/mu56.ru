import Image from "next/image";
import { messengers } from "@/lib/contacts";

export function MessengerLinks({ className = "", iconsOnly = false }: { className?: string; iconsOnly?: boolean }) {
  return <div className={`messenger-links ${className}`}>
    {messengers.map(item => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`Написать в ${item.name}`} title={`Написать в ${item.name}`}>
      <Image src={`/media/brands/${item.name === "Telegram" ? "telegram" : "max"}.svg`} width={24} height={24} alt="" aria-hidden="true" />
      <span className={iconsOnly ? "messenger-icon-label" : undefined}>{item.name}</span>
    </a>)}
  </div>;
}
