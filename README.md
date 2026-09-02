<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-icon.svg">
  <img src="public/logo-icon-black.svg" alt="PostShip" height="72">
</picture>

# PostShip

Surveillance post-déploiement pour sites et SaaS indie.

Après chaque deploy Vercel (ou toutes les 5 minutes), PostShip ouvre tes URLs critiques comme un utilisateur : HTTP, Open Graph, sitemap, JSON-LD, SSL, optionnellement la page succès Stripe. Alerte Discord + email si ça casse. Silence si tout est vert.

## Lancer le build avec Claude Code

```bash
mkdir postship && cd postship
git init
# Copier le contenu de PROMPT-DEPART-CLAUDE-CODE.md
claude
```

Colle le prompt de départ en entier. Attends la Phase 0. Tape `GO slice 1` seulement après relecture des specs.

Les fichiers de ce dossier (`CLAUDE.md`, `docs/*`) sont déjà la Phase 0. Tu peux les copier dans le repo vide **avant** `claude` pour gagner une étape, puis coller le prompt en disant : « Phase 0 already on disk. Review it. If complete, wait for GO slice 1. »

## Stack

Next.js 15 · TypeScript · Tailwind · shadcn/ui · Supabase · Stripe · Resend · Cron Vercel · Vercel.

## Hors scope

Pas d’APM, pas d’Ahrefs, pas de facturation client, pas de status page publique au MVP.
