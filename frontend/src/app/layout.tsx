import type { Metadata } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/unbounded/600.css";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StoreProvider } from "@/components/store-provider";
import { LeadDialog } from "@/components/lead-dialog";
import { getOfferings } from "@/lib/catalog";

import { StructuredData } from "@/components/structured-data";
import { organization, siteOrigin, indexingEnabled } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: "Мир Улыбок — детские праздники и трансформеры в Оренбурге", template: "%s | Мир Улыбок, Оренбург" },
  description: "Выездные детские праздники в Оренбурге: трансформеры, любимые персонажи, шоу и готовые пакеты. Оплата после праздника. Подберём программу для вашего ребёнка.",
  robots: { index: indexingEnabled, follow: indexingEnabled },
  openGraph: { locale: "ru_RU", type: "website", siteName: "Мир Улыбок", images: [{ url: "/media/bumblebee-live.jpg", alt: "Бамблби на детском празднике" }] },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const offerings = await getOfferings();
  return <html lang="ru" data-scroll-behavior="smooth"><body><StructuredData data={organization} /><StoreProvider><a className="skip-link" href="#main">К содержимому</a><Header />{children}<Footer /><LeadDialog offerings={offerings} /></StoreProvider></body></html>;
}
