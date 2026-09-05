"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyField } from "@/components/copy-field";
import {
  cancelTotpEnrollment,
  enrollTotp,
  unenrollTotp,
  verifyTotpEnrollment,
} from "./mfa-actions";

type Enrollment = { factorId: string; qrCode: string; secret: string; name: string };

export type TotpFactor = {
  id: string;
  friendlyName: string | null;
  createdAt: string | null;
};

// Supabase has no backup codes — a second enrolled device is the whole
// recovery story, so this section is built around a list of devices rather
// than a single on/off switch. Losing the only phone with the only factor
// means losing the account.
export function MfaSection({ factors }: { factors: TotpFactor[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const enabled = factors.length > 0;

  function startEnrollment() {
    const chosen = name.trim() || (enabled ? "Second appareil" : "Mon téléphone");
    startTransition(async () => {
      const result = await enrollTotp(chosen);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEnrollment({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
        name: chosen,
      });
    });
  }

  function confirmEnrollment() {
    if (!enrollment) return;
    startTransition(async () => {
      const result = await verifyTotpEnrollment(enrollment.factorId, code);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setEnrollment(null);
      setCode("");
      setName("");
      router.refresh();
    });
  }

  function cancelEnrollment() {
    if (!enrollment) return;
    startTransition(async () => {
      await cancelTotpEnrollment(enrollment.factorId);
      setEnrollment(null);
      setCode("");
    });
  }

  function remove(factorId: string, label: string) {
    const last = factors.length <= 1;
    const question = last
      ? "Retirer le dernier appareil désactive la double authentification. Continuer ?"
      : `Retirer « ${label} » ?`;
    if (!window.confirm(question)) return;

    startTransition(async () => {
      const result = await unenrollTotp(factorId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Double authentification
      </h2>

      <p className="text-xs text-muted-foreground">
        Un code à 6 chiffres est demandé à chaque connexion, depuis une
        application d&apos;authentification — Google Authenticator, Microsoft
        Authenticator, 1Password, Bitwarden ou toute autre app compatible
        TOTP.
      </p>

      {enabled && (
        <ul className="flex flex-col gap-2">
          {factors.map((factor) => (
            <li
              key={factor.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Smartphone className="size-4 shrink-0 text-[#3fb950]" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {factor.friendlyName ?? "Appareil"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Ajouté le{" "}
                    {factor.createdAt
                      ? new Date(factor.createdAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </span>
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => remove(factor.id, factor.friendlyName ?? "Appareil")}
                disabled={pending}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* The one thing a user can do about a lost phone: Supabase offers no
          recovery codes, so a second device is the backup. */}
      {enabled && factors.length === 1 && !enrollment && (
        <p className="flex items-start gap-2 rounded-2xl bg-[#d29922]/10 px-4 py-3 text-xs text-[#d29922]">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Un seul appareil enregistré. S&apos;il est perdu, vous perdez
          l&apos;accès au compte — ajoutez-en un second pendant que vous le
          pouvez.
        </p>
      )}

      {!enrollment && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="factor-name" className="text-xs text-muted-foreground">
              Nom de l&apos;appareil
            </label>
            <Input
              id="factor-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={enabled ? "ex : iPad de secours" : "ex : iPhone perso"}
              maxLength={40}
            />
          </div>
          <Button variant="outline" onClick={startEnrollment} disabled={pending}>
            {pending ? "..." : enabled ? "Ajouter un appareil" : "Activer"}
          </Button>
        </div>
      )}

      {enrollment && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{enrollment.name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI QR code returned by Supabase, nothing for next/image to optimize */}
          <img
            src={enrollment.qrCode}
            alt="QR code de configuration de la double authentification"
            className="size-40 self-center rounded bg-white p-2"
          />
          <p className="text-xs text-muted-foreground">
            Scannez ce QR code dans votre application. Si vous ne pouvez pas
            scanner, saisissez cette clé à la main :
          </p>
          <CopyField value={enrollment.secret} label="La clé" />
          <div className="flex gap-2">
            <label htmlFor="totp-code" className="sr-only">
              Code de vérification
            </label>
            <Input
              id="totp-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              autoComplete="one-time-code"
              className="flex-1 text-center font-mono tracking-[0.3em]"
            />
            <Button onClick={confirmEnrollment} disabled={pending || code.length !== 6}>
              {pending ? "..." : "Confirmer"}
            </Button>
          </div>
          <button
            type="button"
            onClick={cancelEnrollment}
            className="text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      )}

      {enabled && !enrollment && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-[#3fb950]" aria-hidden="true" />
          {factors.length} appareil{factors.length > 1 ? "s" : ""} pouvant
          valider une connexion.
        </p>
      )}
    </div>
  );
}
