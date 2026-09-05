"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession, requestContext } from "@/lib/admin-auth";
import { recordOpsEvent } from "@/lib/ops-events";
import { getStripe } from "@/lib/stripe";

export type InvoiceActionState = { error?: string; success?: string };

async function traceInvoice(action: string, invoiceId: string) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { ip, userAgent } = await requestContext();

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action,
    target: invoiceId,
  });
  await recordOpsEvent({
    source: "billing",
    severity: "warn",
    action,
    actorAdminId: session.accountId,
    target: invoiceId,
    ip,
    userAgent,
  });
}

export async function resendInvoice(
  invoiceId: string,
  _prev: InvoiceActionState,
): Promise<InvoiceActionState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  try {
    await getStripe().invoices.sendInvoice(invoiceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  await traceInvoice("invoice.resent", invoiceId);
  revalidatePath("/admin/revenue");
  return { success: "Facture renvoyée." };
}

export async function voidInvoice(
  invoiceId: string,
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  // Voiding writes the money off for good — Stripe has no undo — so it
  // asks for the word rather than a click.
  if (String(formData.get("confirm") ?? "").trim() !== "ANNULER") {
    return { error: "Tapez ANNULER pour confirmer." };
  }

  try {
    await getStripe().invoices.voidInvoice(invoiceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  await traceInvoice("invoice.voided", invoiceId);
  revalidatePath("/admin/revenue");
  return { success: "Facture annulée." };
}
