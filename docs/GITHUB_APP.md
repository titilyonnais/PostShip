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
Developer settings, if the App should be owned by the org).

The form is long and almost all of it is left alone. Section by section,
top to bottom:

### Basic information

| Field | Value |
|---|---|
| GitHub App name | `PostShip` |
| Description | the paragraph below |
| Homepage URL | `https://postship.fr` |

Description, shown to anyone on the install screen:

> PostShip vérifie vos URLs critiques après chaque déploiement et publie le résultat sur le commit : un Check Run vert si tout passe, rouge sinon, avec le Ship Score en titre. Accès en écriture aux Checks uniquement — aucun accès à votre code.

### Identifying and authorizing users

Leave the **Callback URL** empty and every checkbox unticked. That
section is for "Sign in with GitHub", which PostShip does not use — the
App never acts on behalf of a GitHub user, only as itself.

### Post installation

| Field | Value |
|---|---|
| Setup URL | `https://postship.fr/api/oauth/github/callback` |
| Redirect on update | **checked** |

This is the one people get wrong. Without the Setup URL the install
completes on GitHub and the user is simply left there, and PostShip never
learns the `installation_id`. "Redirect on update" is what also brings
them back when they later change which repositories are shared.

### Webhook

**Untick "Active".** PostShip never receives GitHub events; it only calls
the API outbound. With the box unticked, the Webhook URL and secret
fields disappear and there is nothing else to fill in here.

### Permissions

This is the part that matters. Open **Repository permissions** and set
exactly one:

| Permission | Access |
|---|---|
| **Checks** | **Read and write** |

Leave every other repository permission on **No access** — Contents,
Pull requests, Issues, Actions, Administration, all of them. PostShip
never reads your code.

`checks:write` is the whole requirement: write access to the Checks API
is only available to GitHub Apps, and it is what
`POST /repos/{owner}/{repo}/check-runs` needs
([Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps),
[REST API endpoints for check runs](https://docs.github.com/en/rest/checks/runs)).

Two things GitHub does on its own, which are expected and should be left
as they are:

- **Metadata: Read-only** gets selected automatically as soon as any
  repository permission is set, and cannot be turned off. It grants
  nothing beyond basic repository metadata.
- The permission count in the sidebar will read **2** (Checks + Metadata),
  not 1.

**Organization permissions** and **Account permissions**: leave every row
on **No access**. Nothing in PostShip touches either.

### Subscribe to events

Nothing to tick — the list is only offered because of the webhook, which
is off. If any boxes are checked, uncheck them.

### Where can this GitHub App be installed?

**Any account.** "Only on this account" would mean only your own repos
could install it, so no customer could ever connect theirs.

### Then

Create the App, scroll to **Private keys → Generate a private key**.
GitHub downloads a `.pem` once and never shows it again. Upload
`public/brand/postship-avatar-1024.png` as the App's logo while you are
there — same mark as the Discord and Slack apps.

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
