import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminLoginForm } from "./login-form";

export const metadata = {
  title: "Console",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08090b] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] tracking-[0.25em] text-[#3fb950] uppercase">
            Accès restreint
          </span>
          <h1 className="font-mono text-lg text-neutral-100">postship / console</h1>
          <p className="text-xs text-neutral-500">
            Mot de passe et code d&apos;authentification requis ensemble.
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
