// Kept out of actions.ts on purpose: a "use server" file can only export
// async functions (Server Actions) — a plain string export there breaks
// the whole module.
export const CONSENT_ERROR =
  "Vous devez accepter les CGU et la politique de confidentialité pour continuer.";

// Deliberately identical whether or not an account already exists at this
// email — differentiating ("cet email est déjà utilisé", "connectez-vous
// plutôt") lets an attacker enumerate registered accounts one guess at a
// time. Used for both magic link and password signup outcomes.
export const GENERIC_AUTH_MESSAGE =
  "Si un compte est associé à cette adresse, vous recevrez un email.";
