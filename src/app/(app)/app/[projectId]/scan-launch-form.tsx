import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { startSiteScan } from "./scan-actions";

export function ScanLaunchForm({
  projectId,
  baseUrl,
  tokenBalance,
}: {
  projectId: string;
  baseUrl: string;
  tokenBalance: number;
}) {
  return (
    <ActionForm action={startSiteScan.bind(null, projectId)} className="flex gap-2">
      <label htmlFor="seed_url" className="sr-only">
        URL de départ
      </label>
      <Input
        id="seed_url"
        name="seed_url"
        type="url"
        defaultValue={baseUrl}
        className="flex-1"
      />
      <SubmitButton variant="outline" disabled={tokenBalance < 1} pendingText="...">
        Lancer
      </SubmitButton>
    </ActionForm>
  );
}
