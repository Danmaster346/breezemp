// Динамический sitemap.xml: статические страницы + активные товары и продавцы.
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE_URL = "https://kupiks-marketplace.ru";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/catalog", changefreq: "daily", priority: "0.9" },
          { path: "/help", changefreq: "monthly", priority: "0.5" },
          { path: "/contacts", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/track-order", changefreq: "monthly", priority: "0.4" },
        ];

        try {
          const { data: products } = await supabaseAdmin
            .from("products")
            .select("id")
            .eq("is_active", true)
            .eq("moderation_status", "approved")
            .limit(2000);
          for (const p of products ?? []) {
            entries.push({ path: `/product/${p.id}`, changefreq: "weekly", priority: "0.8" });
          }

          const { data: sellers } = await supabaseAdmin
            .from("seller_profiles")
            .select("user_id")
            .limit(500);
          for (const s of sellers ?? []) {
            entries.push({ path: `/seller/${s.user_id}`, changefreq: "weekly", priority: "0.6" });
          }
        } catch {
          // При недоступности БД отдаём хотя бы статические страницы
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
