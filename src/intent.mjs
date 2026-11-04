// Rough intent guesses from the words in a keyword and from a page's URL and title.
// These are heuristics. A topic file can state the intent itself and that always wins.

const TOPIC_RULES = [
  ["transactional", /\b(buy|price|prices|pricing|cost|costs|cheap|order|hire|quote|book|booking|near me|discount|deal|deals|subscription|for sale|rental|rent)\b/i],
  ["commercial", /\b(best|top|reviews?|vs|versus|alternatives?|compare|comparison)\b/i],
  ["informational", /\b(how|what|why|when|guide|tutorial|tips|learn|examples?|checklist|meaning|explained)\b/i],
];

const PAGE_RULES = [
  ["transactional", /\/(pricing|prices?|shop|store|products?|buy|order|book|booking|services?|cart|quote|contact)(\/|$)/i],
  ["commercial", /\/(compare|comparison|vs|reviews?|best|alternatives?)(\/|$)/i],
  ["informational", /\/(blog|guides?|learn|resources|articles?|news|how-to|faq|help|docs|tips)(\/|$)/i],
];

const TITLE_RULES = [
  ["informational", /^(how|what|why|when|guide|a guide|the complete guide)\b/i],
  ["commercial", /^(best|top \d+|\d+ best)\b|\b(vs|versus|review)\b/i],
];

export function topicIntent(keyword, given) {
  if (given && ["informational", "commercial", "transactional", "navigational"].includes(given)) return given;
  for (const [intent, re] of TOPIC_RULES) if (re.test(keyword)) return intent;
  return "unknown";
}

export function pageIntent(pathname, title) {
  for (const [intent, re] of PAGE_RULES) if (re.test(pathname)) return intent;
  for (const [intent, re] of TITLE_RULES) if (re.test(title || "")) return intent;
  return "unknown";
}

// Only the clear clash counts: someone ready to buy landing on an article, or
// someone asking a question landing on a sales page.
export function intentMismatch(topic, page) {
  const pair = new Set([topic, page]);
  return pair.size === 2 && pair.has("transactional") && pair.has("informational");
}
