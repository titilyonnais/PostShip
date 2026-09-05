"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resendInvoice, voidInvoice, type InvoiceActionState } from "./invoice-actions";

const initial: InvoiceActionState = {};

function Btn({ children, danger }: { children: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border px-2 py-0.5 text-[0.65rem] disabled:opacity-50 ${
        danger
          ? "border-[#f85149]/40 text-[#f85149] hover:border-[#f85149]"
          : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
      }`}
    >
      {pending ? "..." : children}
    </button>
  );
}

export function OutstandingActions({ invoiceId }: { invoiceId: string }) {
  const [resend, resendAction] = useActionState(resendInvoice.bind(null, invoiceId), initial);
  const [voided, voidAction] = useActionState(voidInvoice.bind(null, invoiceId), initial);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <form action={resendAction}>
          <Btn>Relancer</Btn>
        </form>
        <form action={voidAction} className="flex items-center gap-1">
          <input
            name="confirm"
            placeholder="ANNULER"
            className="w-24 border border-neutral-800 bg-[#0d0f12] px-1.5 py-0.5 text-[0.65rem] text-neutral-100 placeholder:text-neutral-700 focus:border-[#f85149] focus:outline-none"
          />
          <Btn danger>Annuler</Btn>
        </form>
      </div>
      {(resend.error || voided.error) && (
        <span className="text-[0.65rem] text-[#f85149]">{resend.error ?? voided.error}</span>
      )}
      {(resend.success || voided.success) && (
        <span className="text-[0.65rem] text-[#3fb950]">
          {resend.success ?? voided.success}
        </span>
      )}
    </div>
  );
}
