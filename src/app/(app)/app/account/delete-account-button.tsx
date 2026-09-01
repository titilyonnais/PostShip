"use client";

import { Button } from "@/components/ui/button";
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
      <Button type="submit" variant="destructive">
        Supprimer mon compte
      </Button>
    </form>
  );
}
