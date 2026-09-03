import { notFound } from "next/navigation";
import { DOCS, getDocPage } from "@/lib/docs";

export async function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  return { title: page ? page.title : "Documentation" };
}

export default async function DocSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) notFound();

  return (
    <article className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.title}</h1>
        <p className="text-sm text-muted-foreground">{page.summary}</p>
      </div>

      <div className="flex flex-col gap-6">
        {page.sections.map((section, index) => (
          <section key={index} className="flex flex-col gap-2">
            {section.heading && (
              <h2 className="text-base font-medium">{section.heading}</h2>
            )}
            <p className="text-sm text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
