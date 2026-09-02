// Bumped whenever the wording of /terms, /privacy or /cgv materially
// changes — profiles.terms_version / privacy_version pin which version a
// given user actually consented to, independent of terms_accepted_at (the
// timestamp alone doesn't say what they agreed to if the text changes
// later).
export const CURRENT_TERMS_VERSION = "2026-09-01";
export const CURRENT_PRIVACY_VERSION = "2026-09-01";
export const CURRENT_CGV_VERSION = "2026-09-02";

// Single source of truth for every legal-page identity field. Fields the
// founder hasn't confirmed yet are "FIXME_LEGAL" — never a guessed SIRET,
// phone number, mediator, or VAT status. Every legal page must read from
// here instead of hardcoding these values a second time.
export const LEGAL = {
  editorName: "Thibault Morretton",
  editorStatus: "FIXME_LEGAL", // devient "EI" une fois le statut confirmé
  address: "19 Route de Lyon, 42400 Saint-Chamond, France",
  // Adresse de contact réellement publiée aujourd'hui — voir
  // publicEmailFallback ci-dessous, à retirer dès que contact@postship.fr existe.
  email: "FIXME_LEGAL",
  phone: "FIXME_LEGAL",
  siret: "FIXME_LEGAL",
  tvaMention: "FIXME_LEGAL", // "TVA non applicable, article 293 B du CGI" OU n° de TVA intracommunautaire
  publicationDirector: "Thibault Morretton",
  host: {
    name: "Vercel Inc.",
    address: "FIXME_LEGAL", // coller l'adresse officielle depuis vercel.com/legal
    phone: "FIXME_LEGAL",
    url: "https://vercel.com",
  },
  mediator: {
    name: "FIXME_LEGAL",
    url: "FIXME_LEGAL",
  },
  // L'email actuellement publié sur le site, tant que LEGAL.email vaut
  // FIXME_LEGAL — à retirer dès que contact@postship.fr existe.
  publicEmailFallback: "tmorretton@gmail.com",
} as const;
