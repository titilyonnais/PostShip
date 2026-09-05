// Bot detection.
//
// The first version was a regex over the user agent, and it was wrong in
// both directions: it missed anything that sets a browser UA (which is
// most scrapers worth catching) and it stuck a permanent "robot" badge on
// an address the moment one crawler touched it — including a phone behind
// a carrier NAT.
//
// This scores the request instead, and the strongest signals are not in
// the user agent at all. A real browser navigating to a page sends a
// Sec-Fetch-Mode of navigate, a Sec-Fetch-Dest of document, an Accept
// that asks for HTML, and an Accept-Language. Automated clients almost
// never send all four, because they are set by the browser rather than by
// whoever wrote the script. Those headers are only present over HTTPS in
// modern browsers, which is exactly the traffic this sees.

export type BotSignal = { id: string; label: string; weight: number };

export type BotVerdict = {
  /** 0 = certainly human, 100 = certainly automated. */
  score: number;
  isBot: boolean;
  signals: BotSignal[];
};

// Self-identified crawlers. Anything here is settled: no score needed,
// they are telling us what they are and the polite ones deserve to be
// classified correctly rather than counted as visitors.
const DECLARED = /bot\b|crawler|crawling|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|applebot|petalbot|yandex|baiduspider|duckduckbot|semrush|ahrefs|mj12bot|dotbot|screaming frog/i;

// Tools that never pretend otherwise.
const TOOLING =
  /curl\/|wget\/|libwww|python-requests|python-urllib|aiohttp|httpx\/|axios\/|node-fetch|got \(|okhttp|java\/|go-http-client|ruby|php\/|postman|insomnia|scrapy|selenium|playwright|puppeteer|headlesschrome|phantomjs|lighthouse/i;

// Monitoring services, ours included. Real traffic, not a visitor.
const MONITORING = /pingdom|uptimerobot|statuscake|newrelic|datadog|site24x7|postshipbot|betteruptime|checkly/i;

const THRESHOLD = 50;

export function detectBot(headers: {
  userAgent: string | null;
  accept: string | null;
  acceptLanguage: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
  secFetchSite: string | null;
}): BotVerdict {
  const ua = headers.userAgent ?? "";
  const signals: BotSignal[] = [];

  const settle = (id: string, label: string): BotVerdict => ({
    score: 100,
    isBot: true,
    signals: [{ id, label, weight: 100 }],
  });

  if (!ua.trim()) return settle("ua.empty", "Aucun user-agent");
  if (DECLARED.test(ua)) return settle("ua.declared", "Robot déclaré dans le user-agent");
  if (TOOLING.test(ua)) return settle("ua.tooling", "Client automatisé (outil en ligne de commande ou bibliothèque)");
  if (MONITORING.test(ua)) return settle("ua.monitoring", "Service de supervision");

  const add = (id: string, label: string, weight: number) =>
    signals.push({ id, label, weight });

  // A browser navigating to a document sends all of these. Missing them
  // is the tell that survives a spoofed user agent, because they are set
  // by the browser and not by the script author.
  if (!headers.secFetchMode) add("fetch.no_mode", "Sec-Fetch-Mode absent", 35);
  else if (headers.secFetchMode !== "navigate") {
    add("fetch.not_navigate", `Sec-Fetch-Mode ${headers.secFetchMode}`, 10);
  }

  if (!headers.secFetchDest) add("fetch.no_dest", "Sec-Fetch-Dest absent", 25);
  else if (headers.secFetchDest !== "document" && headers.secFetchDest !== "empty") {
    add("fetch.not_document", `Sec-Fetch-Dest ${headers.secFetchDest}`, 10);
  }

  if (!headers.acceptLanguage) add("no_language", "Accept-Language absent", 25);

  if (!headers.accept) add("no_accept", "Accept absent", 20);
  else if (!headers.accept.includes("text/html") && !headers.accept.includes("*/*")) {
    add("accept.not_html", "Accept ne demande pas de HTML", 15);
  }

  // Shape checks on the user agent itself. A real one names an engine and
  // a platform; a short or structureless one is usually hand-written.
  if (ua.length < 40) add("ua.short", "User-agent anormalement court", 20);
  if (!/mozilla\/5\.0/i.test(ua)) add("ua.no_mozilla", "User-agent sans préfixe Mozilla/5.0", 15);
  if (!/\((?:[^)]*)\)/.test(ua)) add("ua.no_platform", "User-agent sans bloc plateforme", 15);

  const score = Math.min(100, signals.reduce((total, s) => total + s.weight, 0));

  return { score, isBot: score >= THRESHOLD, signals };
}

// Per-address verdict. An IP is not a bot; its traffic is. A phone behind
// a carrier NAT shares an address with whatever else that carrier routes,
// and one crawler hit should never brand it — so the badge comes from the
// share of automated traffic, not from a single sticky flag.
export function classifyAddress(botHits: number, totalHits: number): {
  label: "humain" | "mixte" | "robot";
  ratio: number;
} {
  if (totalHits <= 0) return { label: "humain", ratio: 0 };
  const ratio = botHits / totalHits;
  // Deliberately high: mislabelling a customer as a robot in a fraud
  // console is far more costly than missing a crawler.
  if (ratio >= 0.9) return { label: "robot", ratio };
  if (ratio >= 0.4) return { label: "mixte", ratio };
  return { label: "humain", ratio };
}
