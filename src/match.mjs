import { tokenize } from "./tokenize.mjs";
import { pathKey } from "./load.mjs";
import { pageIntent } from "./intent.mjs";

export const DEFAULTS = { coveredAt: 0.9, weakAt: 0.45, language: "en" };

export function prepareTopic(topic, cfg) {
  const seq = tokenize(topic.keyword, { language: cfg.language });
  return { ...topic, seq, tokens: [...new Set(seq)] };
}

export function indexPage(page, cfg) {
  const key = pathKey(page.url);
  const t = (s) => tokenize(s, { language: cfg.language });
  const slugText = key.replace(/[\/_.-]+/g, " ");
  const hasContent = Boolean(page.title || page.h1 || page.description || page.text || (page.headings && page.headings.length));
  return {
    url: page.url,
    path: key,
    evidence: hasContent ? "content" : "url-only",
    intent: pageIntent(key, page.title || page.h1),
    fields: {
      slug: t(slugText),
      title: t(page.title),
      h1: t(page.h1),
      headings: t((page.headings || []).join(" . ")),
      description: t(page.description),
      body: t(page.text),
    },
  };
}

const coverage = (tokens, field) => (tokens.length ? tokens.filter((tok) => field.includes(tok)).length / tokens.length : 0);

function hasPhrase(seq, field) {
  if (!seq.length) return false;
  for (let i = 0; i + seq.length <= field.length; i += 1) {
    if (seq.every((tok, j) => field[i + j] === tok)) return true;
  }
  return false;
}

export function scorePage(topic, idx) {
  const f = idx.fields;
  const primaryFields = [f.title, f.h1, f.slug];
  const P = Math.max(...primaryFields.map((x) => coverage(topic.tokens, x)));
  const phraseInPrimary = primaryFields.some((x) => hasPhrase(topic.seq, x));
  const S = Math.max(coverage(topic.tokens, f.headings), coverage(topic.tokens, f.description));
  const B = coverage(topic.tokens, f.body);
  const pAdj = P === 1 ? (phraseInPrimary ? 1 : 0.9) : P * 0.85;
  const score = Math.max(pAdj, 0.7 * S, 0.45 * B);
  const union = new Set(Object.values(f).flat());
  const present = topic.tokens.filter((tok) => union.has(tok));
  const missingInPrimary = topic.tokens.filter((tok) => !primaryFields.some((x) => x.includes(tok)));
  return {
    url: idx.url,
    path: idx.path,
    score: Math.round(score * 100) / 100,
    primary: Math.round(P * 100) / 100,
    secondary: Math.round(S * 100) / 100,
    body: Math.round(B * 100) / 100,
    phraseInPrimary,
    allWordsOnPage: present.length === topic.tokens.length,
    coverageAnywhere: Math.round((present.length / topic.tokens.length) * 100) / 100,
    missingInPrimary,
    evidence: idx.evidence,
    pageIntent: idx.intent,
  };
}
