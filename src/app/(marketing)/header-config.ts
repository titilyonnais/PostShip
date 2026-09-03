export type HeaderLink = { label: string; href: string };
export type HeaderSlot = { label: string; href: string } | null;
export type HeaderConfig = { links: HeaderLink[]; slot: HeaderSlot };

// S2b (site backlog): the 4 section links never change — only the page
// content (current page rendered non-clickable) and the right-hand slot
// vary. Kept here so the header component never hardcodes routing logic.
export const SECTION_LINKS: HeaderLink[] = [
  { label: "Produit", href: "/produit" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Documentation", href: "/docs" },
  { label: "Journal", href: "/changelog" },
];

const OUVRIR_APP: HeaderSlot = { label: "Ouvrir l'app", href: "/app" };

// A slot label that gets replaced by "Ouvrir l'app" once the visitor is
// signed in — used both here and by the header to decide whether the
// separate Connexion/account link should render alongside it (never two
// controls for the same action).
export const ANONYMOUS_ONLY_SLOT_LABELS = [
  "Commencer",
  "Prendre Solo",
  "Ouvrir l'app",
] as const;

// Pure pathname (+auth) → header config mapper. No JSX, no routing
// side-effects — the header component only renders what this returns.
export function getHeaderConfig(pathname: string, isLoggedIn: boolean): HeaderConfig {
  const links = SECTION_LINKS;

  if (pathname === "/") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/login?plan=free" } };
  }
  if (pathname === "/produit") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir les tarifs", href: "/pricing" } };
  }
  if (pathname === "/pricing") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Prendre Solo", href: "/login?plan=solo" } };
  }
  if (pathname === "/changelog") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir le produit", href: "/produit" } };
  }
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/login?plan=free" } };
  }
  if (pathname === "/login") {
    // The form itself is the action — no competing CTA, no NavAuth either
    // (the header hides its auth link separately for this one route).
    return { links, slot: null };
  }
  // Legal pages, and anything else not explicitly mapped above.
  return { links, slot: { label: "Accueil", href: "/" } };
}
