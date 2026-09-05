"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession, requestContext } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { recordOpsEvent } from "@/lib/ops-events";

export type TrustState = { error?: string; success?: string };

// An office, a campus, a mobile carrier NAT — all of them put many
// accounts behind one address, and none of them is fraud. Without a way
// to say so, the linkage signal would flag the same legitimate address
// forever and the operator would learn to ignore it, which is worse than
// not having the signal at all.
export async function setIpTrusted(
  ip: string,
  trusted: boolean,
  _prev: TrustState,
): Promise<TrustState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { error } = await createServiceClient()
    .from("visitor_ips")
    .update({ trusted })
    .eq("ip", ip);

  if (error) return { error: error.message };

  const { ip: operatorIp, userAgent } = await requestContext();
  const action = trusted ? "ip.trusted" : "ip.untrusted";

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action,
    target: ip,
  });
  await recordOpsEvent({
    source: "console",
    action,
    actorAdminId: session.accountId,
    target: ip,
    ip: operatorIp,
    userAgent,
  });

  revalidatePath(`/admin/visitors/${encodeURIComponent(ip)}`);
  return {
    success: trusted
      ? "Adresse marquée de confiance — elle ne compte plus dans le score."
      : "Marquage retiré.",
  };
}
