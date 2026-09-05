import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · Console" },
  robots: { index: false, follow: false, nocache: true },
};

// Deliberately not the customer app's chrome: no sidebar, no project
// switcher, no marketing header. A console that looks like the product is
// a console someone eventually mistakes for the product.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#08090b] text-neutral-200">{children}</div>;
}
