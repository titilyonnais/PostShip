import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/docs`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${APP_URL}/cgv`, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${APP_URL}/mentions-legales`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
