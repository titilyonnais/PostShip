import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { LocaleSelect } from "./locale-select";
import { updateNotificationPrefs } from "./actions";

export function NotificationsTab({
  emailAlertsEnabled,
  locale,
}: {
  emailAlertsEnabled: boolean;
  locale: string;
}) {
  return (
    <ActionForm action={updateNotificationPrefs} className="flex flex-col gap-5">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="email_alerts_enabled"
          defaultChecked={emailAlertsEnabled}
          className="mt-0.5 size-3.5 rounded border-input accent-foreground"
        />
        <span>
          Recevoir les alertes par email
          <span className="block text-xs text-muted-foreground">
            Discord (si configuré par projet) n&apos;est pas affecté par ce
            réglage.
          </span>
        </span>
      </label>

      <div className="flex max-w-[12rem] flex-col gap-1">
        <label htmlFor="locale" className="text-xs text-muted-foreground">
          Langue de l&apos;interface
        </label>
        <LocaleSelect defaultValue={locale} />
      </div>

      <div>
        <SubmitButton pendingText="Enregistrement...">
          Enregistrer les préférences
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
