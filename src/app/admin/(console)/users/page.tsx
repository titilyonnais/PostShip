import { Panel } from "@/components/admin/console-ui";
import { getAdminUsers } from "@/lib/admin";
import { UsersTable } from "./users-table";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function ConsoleUsers() {
  const users = await getAdminUsers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-neutral-100">
        Utilisateurs <span className="text-neutral-600">({users.length})</span>
      </h1>

      <Panel>
        <UsersTable users={users} />
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Le score affiché ici est celui du balayage nocturne, signaux Stripe
        compris — le même que sur la fiche. Une fiche ouverte recalcule en
        direct, donc un écart signifie simplement que quelque chose a bougé
        depuis la nuit dernière. Pas d&apos;usurpation d&apos;identité.
      </p>
    </div>
  );
}
