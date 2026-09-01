"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelTotpEnrollment,
  enrollTotp,
  unenrollTotp,
  verifyTotpEnrollment,
} from "./mfa-actions";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MfaSection({
  enabled,
  factorId,
}: {
  enabled: boolean;
  factorId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");

  function startEnrollment() {
    startTransition(async () => {
      const result = await enrollTotp();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEnrollment({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
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

  function disable() {
    if (!factorId) return;
    if (!window.confirm("Désactiver la double authentification ?")) return;
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

      {enabled && !enrollment && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-[#3fb950]" aria-hidden="true" />
            Activée — un code est demandé à chaque connexion.
          </p>
          <Button variant="outline" onClick={disable} disabled={pending}>
            Désactiver
          </Button>
        </div>
      )}

      {!enabled && !enrollment && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Demande un code à 6 chiffres depuis une application
            d&apos;authentification (Google Authenticator, 1Password...) à
            chaque connexion.
          </p>
          <div>
            <Button variant="outline" onClick={startEnrollment} disabled={pending}>
              {pending ? "..." : "Activer"}
            </Button>
          </div>
        </div>
      )}

      {enrollment && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI QR code returned by Supabase, nothing for next/image to optimize */}
          <img
            src={enrollment.qrCode}
            alt="QR code de configuration de la double authentification"
            className="size-40 self-center rounded bg-white p-2"
          />
          <p className="text-center text-xs text-muted-foreground">
            Scannez ce QR code, ou saisissez manuellement :{" "}
            <span className="font-mono text-foreground">{enrollment.secret}</span>
          </p>
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
            <Button
              onClick={confirmEnrollment}
              disabled={pending || code.length !== 6}
            >
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
    </div>
  );
}
