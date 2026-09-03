import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "Journal",
};

// S5 (site backlog): a static list of real ships, not a generator. Update
// this array by hand when something user-facing ships — see the commit
// history (F1-V7) for what each entry corresponds to.
const ENTRIES: { date: string; title: string; body: string }[] = [
  {
    date: "2026-09-01",
    title: "Détection d'assets cassés et parcours argent",
    body: "Un fichier JS ou CSS manquant après déploiement est maintenant détecté, avec un préréglage pour surveiller en priorité les pages qui encaissent de l'argent (checkout, paiement).",
  },
  {
    date: "2026-09-01",
    title: "Aperçu de carte sociale",
    body: "Chaque URL surveillée affiche un aperçu réel de sa carte Open Graph — titre, description, image — directement dans le tableau de bord.",
  },
  {
    date: "2026-09-01",
    title: "Alertes Telegram",
    body: "Discord et Slack étaient déjà là. Telegram s'ajoute comme troisième canal d'alerte, avec un bot par projet.",
  },
  {
    date: "2026-09-01",
    title: "GitHub Check Run sur chaque déploiement",
    body: "Un déploiement Vercel en production affiche désormais le résultat de la vérification PostShip directement sur le commit GitHub.",
  },
  {
    date: "2026-09-02",
    title: "Historique des déploiements",
    body: "La page Déplois garde la trace de chaque déclenchement Vercel, Netlify ou Cloudflare Pages, avec ce qui a cassé ou s'est rétabli depuis le précédent.",
  },
  {
    date: "2026-09-02",
    title: "Règles d'alerte : confirmation, heures calmes, silence",
    body: "Exiger N échecs consécutifs avant d'alerter, définir des heures calmes, ou couper les alertes d'une URL précise pendant une maintenance planifiée.",
  },
  {
    date: "2026-09-03",
    title: "T+2 / T+8 : les minutes qui suivent un ship",
    body: "Après un déploiement en production, deux re-vérifications automatiques à T+2 et T+8 minutes attrapent ce qui casse une fois le cache et le CDN stabilisés.",
  },
  {
    date: "2026-09-03",
    title: "Radar de mutation et Ship Score",
    body: "Un déploiement qui remplace une page par « coming soon » ou une erreur 5xx est détecté et signalé. Chaque déploiement en production reçoit aussi un Ship Score sur 100, avec l'explication de ce qui l'a fait baisser.",
  },
];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Journal</h1>
        <p className="text-sm text-muted-foreground">
          Ce qui a réellement été livré, par ordre chronologique.
        </p>
      </div>

      <ol className="relative flex flex-col gap-8 border-l border-border pl-6">
        {ENTRIES.map((entry, index) => (
          <Reveal key={entry.title} delay={Math.min(index, 4) * 60}>
            <li className="relative flex flex-col gap-1.5">
              <span
                className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-brand-2"
                aria-hidden="true"
              />
              <time dateTime={entry.date} className="font-mono text-xs text-muted-foreground">
                {formatDate(entry.date)}
              </time>
              <h2 className="text-base font-medium">{entry.title}</h2>
              <p className="text-sm text-muted-foreground">{entry.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
