# GitHub App — operator notes

PostShip posts a Check Run on the deployed commit after every
deploy-triggered run. Two credentials can do that, and both stay
supported:

- **A GitHub App installation** — the current path. One click, scoped to
  the repositories the user picks on GitHub's own screen, revoked from
  GitHub. No secret is ever stored on our side: the App signs a short JWT
  with its private key and exchanges it for a one-hour installation token
  per Check Run (`src/lib/github-app.ts`).
- **A fine-grained PAT** — what projects wired up before the App used.
  Still read from `github_token_enc` when no installation is present, so
  nothing broke; nothing new points people at it.

The App itself is created by hand, once, and is not in version control.

## Creating it

**github.com/settings/apps → New GitHub App** (or the organisation's
Developer settings, if it should be owned by the org).

| Field | Value |
|---|---|
| GitHub App name | `PostShip` |
| Homepage URL | `https://postship.fr` |
| Setup URL | `https://postship.fr/api/oauth/github/callback` |
| Redirect on update | **checked** — this is what returns the user to PostShip after they install |
| Webhook | **uncheck Active** — PostShip never receives GitHub events; it only calls the API |
| Repository permissions → Checks | **Read and write** — the only permission needed |
| Where can this be installed | **Any account**, so customers can install it on their own repos |

Description (shown on the install screen):

> PostShip vérifie vos URLs critiques après chaque déploiement et publie le résultat sur le commit : un Check Run vert si tout passe, rouge sinon, avec le Ship Score en titre. Accès en écriture aux Checks uniquement — aucun accès à votre code.

Upload `public/brand/postship-avatar-1024.png` as the App's logo, same
mark as the Discord and Slack apps.

Then **Generate a private key** — GitHub downloads a `.pem` once.

## Environment

Vercel Production, same scoping as every other secret here:

| Variable | Where to find it |
|---|---|
| `GITHUB_APP_ID` | App settings → About → App ID |
| `GITHUB_APP_SLUG` | the last path segment of the App's public URL (`github.com/apps/<slug>`) — it is what builds the install link |
| `GITHUB_APP_PRIVATE_KEY` | the whole `.pem`, `-----BEGIN` line included |

`isGithubAppConfigured()` gates the button on ID + key; without
`GITHUB_APP_SLUG` there is no install URL to send anyone to, so all three
are effectively required. Missing any of them returns
`github_not_configured` and the PAT path keeps working.

The private key accepts either real newlines or literal `\n` sequences,
because a PEM pasted through a shell usually arrives escaped.

## Flow

`/api/oauth/github/start` signs the same `state` the Discord and Slack
quick-connects use (`src/lib/oauth-state.ts`, keyed off the service-role
key) and redirects to `github.com/apps/<slug>/installations/new`.

GitHub returns the user to the Setup URL with `installation_id`,
`setup_action` and that `state`. The callback verifies the state,
re-derives ownership and the plan gate, then calls
`GET /app/installations/{id}` — the id is a plain query parameter, so it
is untrusted until GitHub itself vouches for it; without that check
anyone could point a project at someone else's installation.

`setup_action=request` means an org owner still has to approve; the user
is told so rather than shown a generic failure.
