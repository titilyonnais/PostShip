import Link from "next/link";
import { DOC_CATEGORIES, DOCS } from "@/lib/docs";

export const metadata = {
  title: "Documentation",
};

export default function DocsIndexPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Comment PostShip vérifie votre site, se branche à vos outils, et
          alerte seulement quand ça casse.
        </p>
      </div>

      {DOC_CATEGORIES.map((category) => (
        <section key={category.label} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{category.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {category.slugs.map((slug) => (
              <Link
                key={slug}
                href={`/docs/${slug}`}
                className="flex flex-col gap-1 rounded-2xl border border-border p-4 transition-colors hover:border-foreground/25 focus-visible:border-foreground/25 focus-visible:outline-none"
              >
                <span className="text-sm font-medium">{DOCS[slug].title}</span>
                <span className="text-xs text-muted-foreground">{DOCS[slug].summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
