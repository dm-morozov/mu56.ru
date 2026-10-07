import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/unbounded/600.css";
import "./globals.css";
import { SiteAnalytics } from "@/components/site-analytics";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StoreProvider } from "@/components/store-provider";
import { BookingDialog } from "@/components/booking-dialog";
import { getOfferings } from "@/lib/catalog";
import { bookingCatalog } from "@/lib/booking-catalog";

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
  return <html lang="ru" data-scroll-behavior="smooth"><body><StructuredData data={organization} /><StoreProvider><a className="skip-link" href="#main">К содержимому</a><SiteAnalytics enabled={indexingEnabled} /><Header />{children}<Footer /><BookingDialog catalog={bookingCatalog(offerings)} /></StoreProvider></body></html>;
}
