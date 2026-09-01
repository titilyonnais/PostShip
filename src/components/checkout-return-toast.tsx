"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { kind: "success" | "error"; text: string }> = {
  tokens_success: { kind: "success", text: "Tokens ajoutés à votre solde." },
  tokens_cancelled: { kind: "error", text: "Achat de tokens annulé." },
  success: { kind: "success", text: "Abonnement activé." },
  cancelled: { kind: "error", text: "Paiement annulé." },
};

export function CheckoutReturnToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const checkout = searchParams.get("checkout");
    const error = searchParams.get("error");
    if (!checkout && !error) return;

    handled.current = true;
    if (checkout && MESSAGES[checkout]) {
      const { kind, text } = MESSAGES[checkout];
      toast[kind](text);
    } else if (error) {
      toast.error(error);
    }
    router.replace(pathname);
  }, [pathname, router, searchParams]);

  return null;
}
