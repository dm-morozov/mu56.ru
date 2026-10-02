import type { MetadataRoute } from "next";
import { indexingEnabled, absoluteUrl, crawlerRules } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots { return { rules: crawlerRules(indexingEnabled), ...(indexingEnabled ? { sitemap: absoluteUrl("/sitemap.xml") } : {}) }; }
