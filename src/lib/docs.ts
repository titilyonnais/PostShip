// S6 (site backlog): a structured, multi-page docs section — replaces the
// single-wall page. No MDX engine: plain data, rendered by
// (marketing)/docs/[slug]/page.tsx. Keep each page to 1-3 short sections;
// this is a reference, not a manual.

export type DocSlug =
  | "introduction"
  | "premier-projet"
  | "http-assets"
  | "pack-argent"
  | "open-graph"
  | "sitemap-ssl"
  | "stripe"
  | "webhooks-deploy"
  | "connecter-vercel"
  | "connecter-netlify"
  | "connecter-cloudflare"
  | "connecter-github"
  | "t2-t8"
  | "ship-score"
  | "radar-mutation"
  | "alertes-canaux"
  | "connecter-discord"
  | "connecter-slack"
  | "connecter-telegram"
  | "regles"
  | "webhook-sortant"
  | "app-pages"
  | "bot"
  | "badge-partage"
  | "scans-tokens"
  | "plans";

// `steps` renders as a numbered list under the body — used by the
// "connecter X" pages, where a wall of prose would be unusable next to a
// provider's own settings screen.
export type DocSection = { heading?: string; body: string; steps?: string[] };

export type DocPage = {
  title: string;
  summary: string;
  sections: DocSection[];
};

export type DocCategory = { label: string; slugs: DocSlug[] };

export const DOC_CATEGORIES: DocCategory[] = [
  { label: "Démarrer", slugs: ["introduction", "premier-projet"] },
  {
    label: "Vérifications",
    slugs: ["http-assets", "pack-argent", "open-graph", "sitemap-ssl", "stripe"],
  },
  {
    label: "Déploiements",
    slugs: [
      "webhooks-deploy",
      "connecter-vercel",
      "connecter-netlify",
      "connecter-cloudflare",
      "connecter-github",
      "t2-t8",
      "ship-score",
      "radar-mutation",
    ],
  },
  {
    label: "Alertes",
    slugs: [
      "alertes-canaux",
      "connecter-discord",
      "connecter-slack",
      "connecter-telegram",
      "regles",
      "webhook-sortant",
    ],
  },
  { label: "App", slugs: ["app-pages", "bot", "badge-partage", "scans-tokens"] },
  { label: "Compte", slugs: ["plans"] },
];

export const DOCS: Record<DocSlug, DocPage> = {
  introduction: {
    title: "Introduction",
    summary: "Ce que PostShip fait, en une phrase.",
    sections: [
      {
        body: "PostShip vérifie votre site comme un vrai visiteur, juste après chaque déploiement : statut HTTP, assets JS/CSS, aperçu Open Graph, sitemap, certificat SSL. Vous êtes alerté seulement si quelque chose casse — silence quand tout est vert.",
      },
      {
        heading: "Comment ça s'articule",
        body: "Un projet représente un site (son domaine de production). À l'intérieur, des URLs surveillées — la home, le checkout, une page de login — chacune avec son propre type de vérification. Un webhook de déploiement déclenche une vérification immédiate ; sinon, un cycle automatique tourne toutes les 5 à 30 minutes selon votre plan.",
      },
    ],
  },
  "premier-projet": {
    title: "Premier projet",
    summary: "Créer un projet et ajouter votre première URL.",
    sections: [
      {
        body: "Depuis /app, créez un projet avec le domaine de production de votre site (ex. https://acme.com). Toute URL que vous ajoutez ensuite doit appartenir à ce domaine ou à un de ses sous-domaines — PostShip refuse une cible qui pointe ailleurs, avec un message clair.",
      },
      {
        heading: "Ajouter une URL",
        body: "Depuis la page URLs du projet, collez l'URL à surveiller et choisissez son type (HTTP, Open Graph, sitemap, SSL, ou Stripe en plan Team). La première vérification part immédiatement — comptez quelques secondes pour voir le premier résultat.",
      },
    ],
  },
  "http-assets": {
    title: "HTTP et assets",
    summary: "Le check HTTP de base, et la détection d'assets cassés.",
    sections: [
      {
        body: "Une cible HTTP suit jusqu'à 5 redirections, mesure le TTFB, et vérifie le statut attendu (200 par défaut, configurable). Vous pouvez aussi exiger la présence — ou l'absence — d'un texte précis dans la réponse via les champs « Doit contenir » / « Ne doit pas contenir ».",
      },
      {
        heading: "Assets cassés",
        body: "PostShip repère un fichier JS ou CSS référencé par la page mais qui répond en erreur — le scénario classique d'un déploiement qui casse silencieusement une page qui reste, en apparence, au vert.",
      },
    ],
  },
  "pack-argent": {
    title: "Pack argent",
    summary: "Surveiller en priorité les pages qui encaissent de l'argent.",
    sections: [
      {
        body: "Le préréglage « pack argent » ajoute d'un coup les URLs qui comptent le plus pour votre revenu — checkout, page de paiement, page de succès — avec des vérifications adaptées (statut, assets, contenu attendu). Disponible en plans Solo et Team.",
      },
    ],
  },
  "open-graph": {
    title: "Open Graph",
    summary: "Vérifier que votre carte sociale reste montrable.",
    sections: [
      {
        body: "Une cible Open Graph vérifie que l'image og:image répond en HEAD (200), et que titre et description sont toujours présents. Utile pour éviter un lien partagé sur Slack ou X avec un aperçu cassé — vous voyez l'aperçu réel dans le tableau de bord.",
      },
    ],
  },
  "sitemap-ssl": {
    title: "Sitemap & SSL",
    summary: "Sitemap parsé, certificat surveillé.",
    sections: [
      {
        heading: "Sitemap",
        body: "PostShip parse sitemap.xml (y compris un sitemapindex, en suivant jusqu'à 3 sitemaps enfants), échantillonne jusqu'à 10 URLs et vérifie qu'elles répondent.",
      },
      {
        heading: "SSL",
        body: "Le certificat TLS est contrôlé à chaque cycle. Alertes graduées à J-30, J-7 et J-1 avant expiration, puis si le certificat est expiré — une seule alerte par palier franchi, jamais de rappel quotidien.",
      },
    ],
  },
  stripe: {
    title: "Stripe",
    summary: "Vérifier que la page de succès Stripe répond (plan Team).",
    sections: [
      {
        body: "La vérification Stripe contrôle que votre page de succès (success_url) répond en 2xx après un paiement. C'est un contrôle HTTP simple sur cette URL — PostShip ne rejoue aucun événement webhook Stripe.",
      },
    ],
  },
  "webhooks-deploy": {
    title: "Webhooks Vercel / Netlify / CF",
    summary: "Déclencher une vérification immédiate à chaque déploiement.",
    sections: [
      {
        body: "Chaque hébergeur pointe vers sa propre URL, depuis Paramètres du projet → Intégrations. Vercel : Project Settings → Webhooks, événement deployment.ready. Netlify : Notifications → Deploy notifications → Outgoing webhook, événement « Deploy succeeded ». Cloudflare Pages : Notifications → Destinations → Webhooks, puis une Notification sur « Pages Deployment Success ».",
      },
      {
        body: "Dans les trois cas, un déploiement réussi en production déclenche une vérification immédiate, en plus du cycle automatique. Disponible en plans Solo et Team.",
      },
    ],
  },
  "connecter-vercel": {
    title: "Connecter Vercel",
    summary: "Vérifier le site dès que Vercel a fini de déployer.",
    sections: [
      {
        body: "Sans webhook, PostShip vérifie votre site sur son cycle habituel — toutes les 5 à 30 minutes selon votre plan. Avec, la vérification part dans la seconde qui suit la mise en ligne, pendant que vous regardez encore le déploiement : c'est le moment où une régression coûte le moins cher. Disponible à partir du plan Solo.",
      },
      {
        heading: "Créer le webhook",
        body: "Le webhook se crée au niveau de l'équipe Vercel, pas du projet.",
        steps: [
          "Sur vercel.com, ouvrez les Settings de votre équipe → Webhooks → Create Webhook.",
          "Collez l'URL affichée sur la carte Vercel de la page Intégrations (cliquez dessus pour la copier).",
          "Cochez l'événement « Deployment ready », et limitez le webhook au projet concerné.",
          "Créez-le : Vercel affiche alors un secret. Copiez-le, collez-le dans le champ de la carte Vercel et enregistrez.",
        ],
      },
      {
        heading: "Vérifier que ça marche",
        body: "La carte Vercel affiche « Dernier webhook reçu il y a … » dès qu'une requête correctement signée arrive. Tant qu'elle indique « Aucun webhook reçu », c'est que l'URL ou le secret ne correspond pas — déployez une fois pour trancher : la ligne se met à jour même si l'événement n'a rien déclenché.",
      },
      {
        heading: "Previews",
        body: "L'option en bas de la carte Déploiement étend la vérification aux déploiements de preview : les checks visent alors l'URL de preview et non la production, et les alertes sont préfixées « Preview ».",
      },
    ],
  },
  "connecter-netlify": {
    title: "Connecter Netlify",
    summary: "Vérifier le site dès que Netlify a fini de déployer.",
    sections: [
      {
        body: "Même principe que Vercel : la vérification part à la fin du déploiement au lieu d'attendre le prochain cycle. Une différence pratique — le secret, c'est PostShip qui le génère, parce que Netlify vous demande d'en inventer un. Disponible à partir du plan Solo.",
      },
      {
        heading: "Générer le secret",
        body: "Sur la carte Netlify de la page Intégrations, cliquez sur « Générer un secret ». Il s'affiche une seule fois : copiez-le avant de quitter la page. Vous pourrez toujours en générer un nouveau, mais il faudra alors le mettre à jour côté Netlify.",
      },
      {
        heading: "Créer la notification",
        body: "Tout se passe dans les réglages du site Netlify.",
        steps: [
          "Ouvrez Project configuration → Notifications → Deploy notifications → Add notification → Outgoing webhook.",
          "Événement : « Deploy succeeded ».",
          "URL : celle affichée sur la carte Netlify.",
          "JWS secret token : le secret généré par PostShip.",
          "Enregistrez.",
        ],
      },
      {
        heading: "Vérifier que ça marche",
        body: "La carte affiche « Dernier webhook reçu il y a … » dès la première requête correctement signée. Si elle reste sur « Aucun webhook reçu » après un déploiement, c'est le secret ou l'URL.",
      },
    ],
  },
  "connecter-cloudflare": {
    title: "Connecter Cloudflare Pages",
    summary: "Vérifier le site dès que Cloudflare Pages a fini de déployer.",
    sections: [
      {
        body: "Cloudflare sépare le webhook (la destination) de la notification (ce qui le déclenche) : il faut créer les deux, dans cet ordre. Disponible à partir du plan Solo.",
      },
      {
        heading: "Créer la destination",
        body: "Dans le tableau de bord Cloudflare, au niveau du compte.",
        steps: [
          "Ouvrez Notifications → Destinations → Webhooks → Create.",
          "Collez l'URL affichée sur la carte Cloudflare Pages.",
          "Cloudflare génère un secret à la création : copiez-le, collez-le dans le champ de la carte et enregistrez.",
        ],
      },
      {
        heading: "Créer la notification",
        body: "Le webhook seul ne reçoit rien tant qu'aucune notification ne pointe dessus.",
        steps: [
          "Ouvrez Notifications → Add.",
          "Choisissez l'événement « Pages Deployment Success ».",
          "Comme destination, sélectionnez le webhook créé juste avant.",
          "Enregistrez.",
        ],
      },
      {
        heading: "Vérifier que ça marche",
        body: "La carte passe à « Dernier webhook reçu il y a … » dès la première requête signée. Si rien n'arrive après un déploiement réussi, c'est presque toujours la notification qui manque — le webhook peut très bien exister sans que rien ne le déclenche.",
      },
    ],
  },
  "connecter-github": {
    title: "Connecter GitHub",
    summary: "Publier le résultat de la vérification sur le commit.",
    sections: [
      {
        body: "Une fois connecté, PostShip publie un Check Run sur le commit déployé après chaque vérification déclenchée par un webhook de déploiement : vert si tout passe, rouge sinon, avec le Ship Score comme titre. Vous voyez le résultat dans la pull request sans quitter GitHub. Disponible à partir du plan Solo.",
      },
      {
        heading: "Installer l'app GitHub",
        body: "C'est le chemin recommandé : rien à créer, rien à faire tourner, et la révocation se fait d'un clic côté GitHub.",
        steps: [
          "Depuis Intégrations, carte GitHub, cliquez sur « Installer l'app GitHub ».",
          "Sur l'écran GitHub, choisissez le compte ou l'organisation, puis « Only select repositories » et le dépôt du site surveillé.",
          "Validez : vous revenez sur PostShip. Indiquez le dépôt au format owner/repo et enregistrez.",
        ],
      },
      {
        heading: "Si le dépôt appartient à une organisation",
        body: "GitHub peut exiger l'accord d'un propriétaire de l'organisation. L'installation part alors en demande d'approbation et PostShip vous le dit : la connexion se termine une fois la demande acceptée, en relançant l'installation.",
      },
      {
        heading: "Avec un token, à la place",
        body: "L'ancien chemin reste supporté si vous préférez un jeton que vous contrôlez. Créez un token fine-grained sur GitHub (Settings → Developer settings → Personal access tokens → Fine-grained tokens), limité au dépôt concerné, avec la permission « Checks » en « Read and write » — aucune autre n'est nécessaire. Collez-le dans le champ prévu de la carte GitHub : il est chiffré et jamais réaffiché.",
      },
      {
        heading: "Prérequis",
        body: "Le Check Run se rattache au commit du déploiement, donc il faut qu'un webhook de déploiement soit branché (voir Connecter Vercel) : sans lui, PostShip ne sait pas quel commit vient de partir en production.",
      },
    ],
  },
  "t2-t8": {
    title: "T+2 / T+8",
    summary: "Les minutes qui suivent un déploiement.",
    sections: [
      {
        body: "Après un déploiement en production, PostShip programme deux re-vérifications automatiques : une à T+2 minutes, une à T+8 minutes. Elles attrapent ce qui casse une fois le cache CDN et le edge stabilisés — un problème invisible à la vérification immédiate.",
      },
      {
        body: "La page Déplois affiche le résultat des trois passages : « T+0 OK · T+2 OK · T+8 OK ». Le plan Free ne reçoit que T+0 ; Solo et Team reçoivent T+2 et T+8.",
      },
    ],
  },
  "ship-score": {
    title: "Ship Score",
    summary: "Une note sur 100 après chaque déploiement en production.",
    sections: [
      {
        body: "Chaque déploiement en production part de 100 et perd des points selon ce qui a échoué : −40 si une URL du pack argent échoue, −25 si un asset JS/CSS manque, −15 si une vérification Open Graph échoue, −10 si un certificat SSL expire dans moins de 14 jours, −10 pour toute autre URL en échec. La note ne descend jamais sous 0.",
      },
      {
        body: "Le score et l'explication de ce qui l'a fait baisser (ex. « −15 carte OG ») s'affichent sur l'Aperçu du projet, et deviennent le titre du GitHub Check Run.",
      },
    ],
  },
  "radar-mutation": {
    title: "Radar de mutation",
    summary: "Détecter un contenu remplacé par erreur après un ship.",
    sections: [
      {
        body: "À chaque vérification HTTP, PostShip garde le titre de la page, son H1, sa meta description et son og:title. Une alerte « contenu modifié » part uniquement si le déploiement en cause a fait passer un de ces champs de rempli à vide, ou si le nouveau texte ressemble à « coming soon », « under construction » ou une erreur 5xx.",
      },
      {
        body: "Une simple faute de frappe dans un titre ne déclenche rien, et le radar reste silencieux en dehors d'un déploiement — seul un ship peut être mis en cause.",
      },
    ],
  },
  "alertes-canaux": {
    title: "Email, Discord, Slack, Telegram",
    summary: "Qui reçoit quoi, et quand.",
    sections: [
      {
        body: "Un email part au premier échec détecté, puis à chaque rétablissement — jamais deux alertes identiques en moins de 10 minutes. Discord, Slack et Telegram (plans Solo et Team) reçoivent la même chose en plus de l'email, si configurés depuis Paramètres du projet → Intégrations.",
      },
      {
        body: "Rien n'est envoyé tant que tout est vert : c'est le principe du produit, pas une option à activer.",
      },
    ],
  },
  "connecter-discord": {
    title: "Connecter Discord",
    summary: "Recevoir les alertes dans un salon Discord.",
    sections: [
      {
        body: "Deux chemins mènent au même résultat : le bouton « Connecter Discord », qui crée le webhook pour vous, ou le collage manuel d'une URL de webhook que vous créez vous-même. Le bouton est plus rapide ; le collage manuel fonctionne même si vous n'êtes pas administrateur du serveur, tant que quelqu'un vous fournit l'URL. Disponible à partir du plan Solo.",
      },
      {
        heading: "Avec le bouton « Connecter Discord »",
        body: "Depuis votre projet, ouvrez Intégrations, section Alertes.",
        steps: [
          "Cliquez sur « Connecter Discord ». Discord vous demande de vous authentifier si ce n'est pas déjà fait.",
          "Choisissez le serveur puis le salon qui recevra les alertes. Il vous faut la permission « Gérer les webhooks » sur ce serveur.",
          "Validez : Discord crée le webhook et vous renvoie sur PostShip, qui affiche « Discord connecté ».",
        ],
      },
      {
        heading: "En collant l'URL vous-même",
        body: "Le webhook se crée depuis Discord, dans les paramètres du salon.",
        steps: [
          "Dans Discord, faites un clic droit sur le salon → Modifier le salon → Intégrations → Webhooks.",
          "Créez un webhook, donnez-lui un nom (« PostShip »), puis cliquez sur « Copier l'URL du webhook ».",
          "Collez cette URL dans le champ Discord de la page Intégrations et enregistrez.",
        ],
      },
      {
        heading: "Ce que vous recevez",
        body: "Un message par vérification qui change quelque chose : un encart coloré selon l'état (rouge en échec, vert rétabli, orange contenu modifié), une ligne par URL concernée avec la raison de l'échec, le statut HTTP et le TTFB, et des liens directs vers la page de détail, les incidents et vos réglages d'alertes. Rien n'est envoyé tant que tout est vert.",
      },
      {
        heading: "Couper ou changer de salon",
        body: "Le bouton « Désactiver » sous le champ Discord supprime l'URL enregistrée — PostShip cesse immédiatement d'y écrire. Pour changer de salon, désactivez puis reconnectez. Pour faire taire les alertes temporairement sans rien débrancher, utilisez la mise en silence du projet ou les heures calmes.",
      },
    ],
  },
  "connecter-slack": {
    title: "Connecter Slack",
    summary: "Recevoir les alertes dans un canal Slack.",
    sections: [
      {
        body: "Comme pour Discord, deux chemins : le bouton « Connecter Slack », qui passe par l'écran d'autorisation Slack et crée le webhook entrant pour vous, ou le collage manuel d'une URL que vous créez depuis api.slack.com. Disponible à partir du plan Solo.",
      },
      {
        heading: "Avec le bouton « Connecter Slack »",
        body: "Depuis votre projet, ouvrez Intégrations, section Alertes.",
        steps: [
          "Cliquez sur « Connecter Slack ». Slack affiche son écran d'autorisation.",
          "Choisissez l'espace de travail, puis le canal qui recevra les alertes.",
          "Cliquez sur « Autoriser » : Slack crée le webhook entrant et vous renvoie sur PostShip, qui affiche « Slack connecté ».",
        ],
      },
      {
        heading: "En collant l'URL vous-même",
        body: "Le webhook entrant se crée depuis votre propre application Slack.",
        steps: [
          "Rendez-vous sur api.slack.com/apps et créez une application (« From scratch »), rattachée à votre espace de travail.",
          "Dans le menu de gauche, ouvrez « Incoming Webhooks » et activez l'option.",
          "Cliquez sur « Add New Webhook to Workspace », choisissez le canal, autorisez, puis copiez l'URL qui commence par https://hooks.slack.com/services/.",
          "Collez cette URL dans le champ Slack de la page Intégrations et enregistrez.",
        ],
      },
      {
        heading: "Ce que vous recevez",
        body: "Un message structuré : un titre avec le projet et l'état, un rappel du nombre d'URLs en échec, rétablies ou modifiées, une section par URL avec la raison de l'échec, le statut HTTP et le TTFB, et trois boutons — tableau de bord, incidents, réglages d'alertes. Le bouton principal passe en rouge quand quelque chose est en échec.",
      },
      {
        heading: "Couper ou changer de canal",
        body: "Le bouton « Désactiver » sous le champ Slack supprime l'URL enregistrée. Pour changer de canal, désactivez puis reconnectez — un webhook entrant Slack est lié à un canal précis et ne peut pas être redirigé après coup.",
      },
    ],
  },
  "connecter-telegram": {
    title: "Connecter Telegram",
    summary: "Recevoir les alertes dans une conversation Telegram.",
    sections: [
      {
        body: "Telegram n'a pas de bouton d'installation : chaque projet parle par son propre bot, qu'il faut créer une fois. En revanche vous n'avez plus à aller chercher d'identifiant de conversation — le bot enregistre le salon lui-même. Comptez une minute. Disponible à partir du plan Solo.",
      },
      {
        heading: "Créer le bot",
        body: "Tout se passe dans Telegram, avec le bot officiel @BotFather.",
        steps: [
          "Ouvrez une conversation avec @BotFather et envoyez /newbot.",
          "Donnez un nom, puis un identifiant se terminant par « bot ».",
          "@BotFather répond avec un token de la forme 123456:AbC-… : c'est le token du bot.",
        ],
      },
      {
        heading: "Le brancher sur PostShip",
        body: "Deux champs sur la carte Telegram de la page Intégrations, dont un seul est obligatoire.",
        steps: [
          "Collez le token dans le premier champ, laissez le second vide, et enregistrez.",
          "Envoyez /start à votre bot — depuis une conversation directe, ou depuis un groupe où vous l'avez ajouté.",
          "Le bot répond qu'il est connecté : le salon est enregistré, c'est fini.",
        ],
      },
      {
        heading: "Le champ Chat ID",
        body: "Il ne sert qu'à forcer un salon précis, par exemple pour déplacer les alertes vers un autre groupe sans repasser par /start. Tant qu'il est vide et qu'aucun /start n'est arrivé, la carte affiche « En attente de votre /start ». Laisser un champ vide ne l'efface jamais : il conserve la valeur déjà enregistrée.",
      },
      {
        heading: "Commandes",
        body: "Le bot répond aussi à quelques commandes depuis la conversation — /status, /check, /uptime. Voir la page Bot Telegram.",
      },
    ],
  },
  regles: {
    title: "Règles",
    summary: "Confirmation, heures calmes, silence par URL.",
    sections: [
      {
        heading: "Confirmation",
        body: "Par défaut, une alerte part dès le premier échec. Vous pouvez exiger 2 ou 3 échecs consécutifs avant d'alerter, pour absorber un faux positif ponctuel du réseau.",
      },
      {
        heading: "Heures calmes",
        body: "Définissez une plage horaire (fuseau Europe/Paris) pendant laquelle les alertes sont retardées plutôt qu'envoyées — utile pour ne pas être réveillé pour un incident qui attendra le matin.",
      },
      {
        heading: "Silence par URL",
        body: "Coupez les alertes d'une URL précise pendant 1h, 4h ou 24h avant une maintenance planifiée, sans toucher au reste du projet.",
      },
    ],
  },
  "webhook-sortant": {
    title: "Webhook sortant HMAC",
    summary: "Recevoir les alertes sur votre propre endpoint.",
    sections: [
      {
        body: "En plus d'email/Discord/Slack/Telegram, PostShip peut POSTer chaque alerte (échec, rétablissement, mutation) vers une URL HTTPS de votre choix, signée en HMAC SHA-256.",
      },
      {
        body: "Deux en-têtes accompagnent chaque requête : X-PostShip-Signature (sha256=<empreinte hex du corps>) et X-PostShip-Event. Vérifiez la signature avec le secret affiché une seule fois à la configuration, avant de faire confiance au contenu.",
      },
    ],
  },
  "app-pages": {
    title: "Incidents, Déplois, Santé",
    summary: "Les trois pages qui donnent l'état du projet.",
    sections: [
      {
        heading: "Incidents",
        body: "Ce qui est en échec en ce moment, et le journal de chaque alerte envoyée.",
      },
      {
        heading: "Déplois",
        body: "L'historique de chaque déclenchement Vercel, Netlify ou Cloudflare Pages, avec T+0/T+2/T+8 et ce qui a cassé ou s'est rétabli depuis le précédent.",
      },
      {
        heading: "Santé",
        body: "Certificat SSL, enregistrements DNS, expiration du domaine et indexation de la page d'accueil, réunis au même endroit.",
      },
    ],
  },
  bot: {
    title: "Bot Telegram",
    summary: "Interroger un projet depuis Telegram.",
    sections: [
      {
        body: "Une fois le bot configuré (Paramètres du projet → Intégrations → Telegram), activez les commandes depuis l'onglet Bot. Le bot ne répond qu'au salon configuré — un message venu d'ailleurs est ignoré.",
      },
      {
        body: "Commandes disponibles : /status (résumé + 3 premières URLs en échec), /check (relance une vérification), /uptime (taux 24h et 7j), /ssl (jours restants), /silence 1h|4h|24h|off, /rules (confirm-count et heures calmes en lecture seule), /help.",
      },
    ],
  },
  "badge-partage": {
    title: "Badge & partage",
    summary: "Un badge pass/fail à coller dans votre README.",
    sections: [
      {
        body: "Un badge SVG opt-in par projet — pass/fail uniquement, sans historique, sans liste d'URLs, sans journal d'incidents. 404 tant que le propriétaire ne l'a pas explicitement activé depuis la page Partage. Ce n'est pas une page de statut publique.",
      },
    ],
  },
  "scans-tokens": {
    title: "Scans & tokens",
    summary: "Un scan ponctuel de tout votre site, à la demande.",
    sections: [
      {
        body: "En plus de la surveillance continue, un scan explore votre sitemap (y compris un sitemapindex) puis suit les liens internes en largeur depuis la page de départ, jusqu'à 500 pages, en respectant les règles Disallow de votre robots.txt.",
      },
      {
        body: "Chaque page scannée consomme 1 token. Les tokens s'achètent une fois pour toutes depuis votre compte — pas d'expiration, pas de remboursement une fois consommés, indépendant de votre abonnement.",
      },
    ],
  },
  plans: {
    title: "Plans Free / Solo / Team",
    summary: "Les limites par plan, sans surprise.",
    sections: [
      {
        body: "Free : 1 projet, 3 URLs, vérification toutes les 30 min, alertes email, 7 jours de rétention. Solo (12€/mois) : 3 projets, 15 URLs, toutes les 5 min, Discord/Slack/Telegram, webhooks de déploiement, bot Telegram, 14 jours de rétention. Team (29€/mois) : 10 projets, 50 URLs, tout ce qui précède plus la vérification Stripe, les collaborateurs par projet, 30 jours de rétention.",
      },
      {
        body: "Le nom affiché dans l'app pour le plan supérieur est « Team » — c'est le même partout, y compris sur les tarifs et la facturation.",
      },
    ],
  },
};

export function getDocPage(slug: string): DocPage | null {
  return isDocSlug(slug) ? DOCS[slug] : null;
}

export function isDocSlug(slug: string): slug is DocSlug {
  return Object.prototype.hasOwnProperty.call(DOCS, slug);
}
