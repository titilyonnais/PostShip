import { AlertTriangle } from "lucide-react";
import { DeleteAccountButton } from "../delete-account-button";

export const metadata = {
  title: "Zone dangereuse",
};

export default function AccountDangerPage() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-destructive uppercase">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Zone dangereuse
      </h2>
      <p className="text-xs text-muted-foreground">
        Supprime définitivement votre compte, tous vos projets, targets et
        l&apos;historique des vérifications. Résilie aussi l&apos;abonnement
        Stripe actif s&apos;il y en a un.
      </p>
      <div>
        <DeleteAccountButton />
      </div>
    </div>
  );
}
