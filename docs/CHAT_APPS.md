# Discord & Slack apps — operator notes

How PostShip presents itself inside a customer's chat client. Two halves,
and they are not interchangeable:

- **Discord** — a webhook post can override the author name and avatar, so
  the identity ships from our code (`src/lib/chat-alerts.ts`:
  `username`, `avatar_url`, `embeds[].author`). The Developer Portal entry
  only styles the **authorize screen** the customer sees while connecting.
- **Slack** — an OAuth-installed incoming webhook cannot override the
  author name, icon or channel: those "stubbornly inherit from the
  associated Slack app configuration"
  ([Slack docs](https://docs.slack.dev/legacy/legacy-custom-integrations/legacy-custom-integrations-incoming-webhooks/)).
  Sending `username` / `icon_url` in the payload is silently ignored. So
  **everything a Slack user sees comes from the app config**, not from us.

Both apps are configured by hand in their dashboards; neither is in
version control. This file is what to paste in.

## Shared assets

| File | Size | Use |
|---|---|---|
| `public/brand/postship-avatar-512.png` | 512×512 | Slack app icon (512 is Slack's minimum); Discord webhook `avatar_url` |
| `public/brand/postship-avatar-1024.png` | 1024×1024 | Discord application icon |

Both are the `< >` mark on `#0a0c0e` with ~32% padding — both platforms
crop an avatar to a circle, so the mark has to survive that crop.

Brand color: `#0a0c0e`. Name: `PostShip`, never "PostShip Bot" (Discord
and Slack both append their own BOT/APP tag; adding it ourselves reads as
a duplicate).

## Slack

Paste this at **api.slack.com/apps → your app → App Manifest**, then
Save. It sets the name, the description shown on the install screen, the
message author name, the scope and the redirect URL in one go.

```json
{
  "display_information": {
    "name": "PostShip",
    "description": "Alertes quand votre site casse après un déploiement.",
    "long_description": "PostShip vérifie vos URLs critiques après chaque déploiement, comme le ferait un vrai visiteur : statut HTTP, fichiers JS et CSS réellement servis, présence du prix et de Stripe.js sur le checkout, aperçu Open Graph, sitemap, certificat SSL.\n\nCette intégration poste dans le canal de votre choix quand une vérification échoue, et de nouveau quand tout est rétabli — avec l'URL concernée, la raison précise de l'échec, le statut HTTP et le temps de réponse, plus un lien direct vers le détail dans PostShip.\n\nAucun message tant que tout est vert : c'est le principe du produit.",
    "background_color": "#0a0c0e"
  },
  "features": {
    "bot_user": {
      "display_name": "PostShip",
      "always_online": false
    }
  },
  "oauth_config": {
    "redirect_urls": ["https://postship.fr/api/oauth/slack/callback"],
    "scopes": { "bot": ["incoming-webhook"] }
  },
  "settings": {
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

The manifest cannot carry the icon. Upload
`public/brand/postship-avatar-512.png` by hand at **Basic Information →
Display Information → App icon**.

Still manual, and still required for customers outside our own
workspace: **Manage Distribution → Activate Public Distribution**. Until
that is on, "Connecter Slack" only works in the workspace that owns the
app.

## Discord

**discord.com/developers/applications → PostShip**. Nothing here is
scriptable; these are the fields worth filling.

- **General Information → Description** (shown on the authorize screen,
  400 characters max):

  > PostShip vérifie vos URLs critiques après chaque déploiement — statut HTTP, fichiers JS/CSS, prix et Stripe.js sur le checkout, aperçu Open Graph, sitemap, SSL. Cette autorisation crée un webhook dans le salon de votre choix, et n'y poste que lorsqu'une vérification échoue ou qu'un incident est rétabli. Silence quand tout est vert.

- **App Icon**: `public/brand/postship-avatar-1024.png`.
- **Tags**: `monitoring`, `deploy`, `uptime`, `alerting`, `devops`.
- **OAuth2 → Redirects**: `https://postship.fr/api/oauth/discord/callback`
  — exact match, no trailing slash.
- Leave **Public Bot** and **Requires OAuth2 Code Grant** off: the
  `webhook.incoming` flow adds no bot user to the server.

## Environment

`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SLACK_CLIENT_ID`,
`SLACK_CLIENT_SECRET` — Vercel Production only, mirroring how every other
secret in this project is scoped. Without them the quick-connect buttons
stay inert and return `discord_not_configured` / `slack_not_configured`;
pasting a webhook URL by hand keeps working either way.
