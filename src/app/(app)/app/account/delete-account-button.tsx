"use client";

import { SubmitButton } from "@/components/submit-button";
import { deleteAccount } from "./actions";

export function DeleteAccountButton() {
  return (
    <form
      action={deleteAccount}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Supprimer définitivement votre compte, vos projets et tout l'historique ? Cette action est irréversible.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton variant="destructive" pendingText="Suppression...">
        Supprimer mon compte
      </SubmitButton>
    </form>
  );
}
