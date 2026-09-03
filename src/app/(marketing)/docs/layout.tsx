import { DocsMobileNav } from "./docs-mobile-nav";
import { DocsSidebar } from "./docs-sidebar";

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-12 px-6 py-16 sm:px-10">
      <DocsSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <DocsMobileNav />
        {children}
      </div>
    </div>
  );
}
