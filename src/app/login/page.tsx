import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Link href="/" className="font-mono text-sm text-foreground">
        PostShip
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-md border border-border p-6">
        <h1 className="text-center text-lg font-semibold">Connexion</h1>
        <LoginForm />
      </div>
    </main>
  );
}
