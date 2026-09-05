import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { LocaleSelect } from "./locale-select";
import { updateNotificationPrefs } from "./actions";

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
  disabled,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2 text-sm ${disabled ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 size-3.5 rounded border-input accent-foreground"
      />
      <span>
        {label}
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function NotificationsTab({
  emailAlertsEnabled,
  notifyRecovered,
  notifyMutated,
  notifyDigest,
  notifyProductUpdates,
  digestAvailable,
  locale,
}: {
  emailAlertsEnabled: boolean;
  notifyRecovered: boolean;
  notifyMutated: boolean;
  notifyDigest: boolean;
  notifyProductUpdates: boolean;
  /** Weekly digest is Solo and above (CLAUDE.md plan table). */
  digestAvailable: boolean;
  locale: string;
}) {
  return (
    <ActionForm action={updateNotificationPrefs} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Alertes par email
        </h2>
        {/* These govern the email channel only. Discord, Slack and Telegram
            are configured per project, and silencing someone else's project
            from a personal account setting would be surprising. */}
        <p className="text-xs text-muted-foreground">
          Ne concerne que l&apos;email. Discord, Slack et Telegram se règlent
          projet par projet, dans Intégrations.
        </p>

        <Toggle
          name="email_alerts_enabled"
          defaultChecked={emailAlertsEnabled}
          label="Une URL tombe en échec"
          hint="Le cœur du produit. Décocher coupe tous les emails d'alerte, y compris ceux ci-dessous."
        />
        <Toggle
          name="notify_recovered"
          defaultChecked={notifyRecovered}
          label="Une URL est rétablie"
          hint="La confirmation que c'est reparti. Décochez si seul l'échec vous intéresse."
        />
        <Toggle
          name="notify_mutated"
          defaultChecked={notifyMutated}
          label="Le contenu a changé après un déploiement"
          hint="Un titre, une image de partage ou un prix modifié sans que rien ne casse."
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Résumés et actualités
        </h2>
        <Toggle
          name="notify_digest"
          defaultChecked={notifyDigest}
          disabled={!digestAvailable}
          label="Résumé hebdomadaire"
          hint={
            digestAvailable
              ? "Un email le lundi par projet : disponibilité, vérifications, échecs, SSL."
              : "Disponible à partir du plan Solo."
          }
        />
        <Toggle
          name="notify_product_updates"
          defaultChecked={notifyProductUpdates}
          label="Nouveautés PostShip"
          hint="Rare, et jamais promotionnel : ce qui change dans le produit."
        />
      </div>

      <div className="flex max-w-[12rem] flex-col gap-1 border-t border-border pt-6">
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
