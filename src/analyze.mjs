import { DEFAULTS, prepareTopic, indexPage, scorePage } from "./match.mjs";
import { topicIntent, intentMismatch } from "./intent.mjs";
import { pathKey } from "./load.mjs";
import { slugify } from "./tokenize.mjs";

const round = (n) => Math.round(n * 100) / 100;
const impactOf = (t) => (t.volume ?? 1) * (t.priority ?? 1);

function describeWeak(t, best) {
  const need = `"${t.keyword}"`;
  if (t.intentClash) {
    return `${need} reads as ${t.intent} but the best page (${best.path}) looks ${best.pageIntent}. A different kind of page is needed, not a new title.`;
  }
  const tail = best.evidence === "url-only" ? " Only the URL was available for this page." : "";
  if (best.primary === 1) return `All the words are in the title, H1 or URL of ${best.path}, but not as the phrase.${tail}`;
  if (best.primary > 0) return `Title, H1 and URL of ${best.path} cover ${Math.round(best.primary * t.tokens.length)} of ${t.tokens.length} words. Missing there: ${best.missingInPrimary.join(", ")}.${tail}`;
  if (best.secondary > 0) return `${need} appears only in headings or the description of ${best.path}, not in its title, H1 or URL.${tail}`;
  return `${need} appears only in the body text of ${best.path}.${tail}`;
}

function cluster(missing) {
  const groups = [];
  const used = new Set();
  const byGroup = new Map();
  for (const t of missing) {
    const key = t.target ? `target:${pathKey(t.target)}` : t.group ? `group:${t.group}` : null;
    if (!key) continue;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(t);
    used.add(t);
  }
  groups.push(...byGroup.values());
  const rest = missing.filter((t) => !used.has(t)).sort((a, b) => b.impact - a.impact);
  const jaccard = (a, b) => {
    const A = new Set(a.tokens);
    const inter = b.tokens.filter((x) => A.has(x)).length;
    return inter / (A.size + b.tokens.length - inter);
  };
  const subset = (a, b) => a.tokens.every((x) => b.tokens.includes(x)) || b.tokens.every((x) => a.tokens.includes(x));
  for (const t of rest) {
    const home = groups.find((g) => !g[0].group && !g[0].target && g.some((m) => jaccard(t, m) >= 0.5 || subset(t, m)));
    if (home) home.push(t);
    else groups.push([t]);
  }
  return groups;
}

export function analyze(topicsIn, pagesIn, options = {}) {
  const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  const cfg = { ...DEFAULTS, ...defined };
  const pages = pagesIn.map((p) => indexPage(p, cfg));
  const pageByPath = new Map(pages.map((p) => [p.path, p]));
  const results = [];
  const skipped = [];

  for (const raw of topicsIn) {
    const base = prepareTopic(raw, cfg);
    if (!base.tokens.length) {
      skipped.push({ keyword: raw.keyword, reason: "only stop words, nothing to match" });
      continue;
    }
    const t = { ...base, intent: topicIntent(base.keyword, base.intent), impact: impactOf(base) };
    const scored = pages.map((p) => scorePage(t, p)).sort((a, b) => b.score - a.score || b.coverageAnywhere - a.coverageAnywhere || a.path.length - b.path.length);
    let best = scored[0] || null;
    const notes = [];
    if (t.target) {
      const key = pathKey(t.target);
      const targetIdx = pageByPath.get(key);
      if (!targetIdx) {
        best = null;
        notes.push(`The planned URL ${key} is not in the page list.`);
      } else {
        const own = scored.find((s) => s.path === key);
        const other = scored.find((s) => s.path !== key);
        if (other && other.score - own.score >= 0.2) notes.push(`${other.path} matches better (${other.score}) than the planned page ${key} (${own.score}).`);
        best = own;
      }
    }
    t.intentClash = Boolean(best && intentMismatch(t.intent, best.pageIntent));
    let status;
    let farOff = false;
    if (!best || best.score < cfg.weakAt) status = "missing";
    else if (best.score < cfg.coveredAt && best.coverageAnywhere < 1) {
      status = "missing";
      farOff = true;
    }
    else if (best.score >= cfg.coveredAt && !t.intentClash) status = "covered";
    else status = "weak";
    const reasons = [...notes];
    if (status === "weak") reasons.push(describeWeak(t, best));
    if (status === "missing" && best && best.score > 0) {
      reasons.push(farOff
        ? `Closest page is ${best.path} (${best.score}), but only ${Math.round(best.coverageAnywhere * t.tokens.length)} of ${t.tokens.length} words appear on it at all. This topic needs its own page.`
        : `Closest page is ${best.path} (${best.score}), too far from the topic to count.`);
    }
    results.push({
      keyword: t.keyword,
      intent: t.intent,
      volume: t.volume ?? null,
      priority: t.priority,
      impact: round(t.impact),
      status,
      score: best ? best.score : 0,
      bestPage: best ? best.path : null,
      evidence: best ? best.evidence : null,
      reasons,
      matches: scored.slice(0, 3).filter((s) => s.score > 0).map((s) => ({ path: s.path, score: s.score })),
      _t: t,
      _best: best,
      _scored: scored,
    });
  }

  const byImpact = (a, b) => b.impact - a.impact || a.keyword.localeCompare(b.keyword);

  const overlaps = results
    .filter((r) => r.status === "covered")
    .map((r) => ({ keyword: r.keyword, impact: r.impact, pages: r._scored.filter((s) => s.score >= cfg.coveredAt).map((s) => s.path) }))
    .filter((o) => o.pages.length > 1)
    .sort(byImpact);

  const missing = results.filter((r) => r.status === "missing");
  const missingPages = cluster(missing.map((r) => ({ ...r._t, impact: r.impact })))
    .map((members) => {
      members.sort(byImpact);
      const head = members[0];
      const slug = "/" + slugify(head.keyword);
      return {
        headline: head.keyword,
        suggestedPath: head.target ? pathKey(head.target) : slug,
        intent: head.intent,
        impact: round(members.reduce((s, m) => s + m.impact, 0)),
        keywords: members.map((m) => m.keyword),
        slugTaken: !head.target && pageByPath.has(slug),
        planned: Boolean(head.target),
      };
    })
    .sort((a, b) => b.impact - a.impact || a.headline.localeCompare(b.headline));

  const weakMatches = results
    .filter((r) => r.status === "weak")
    .map((r) => ({ keyword: r.keyword, intent: r.intent, bestPage: r.bestPage, score: r.score, impact: r.impact, reason: r.reasons[r.reasons.length - 1], intentClash: r._t.intentClash }))
    .sort(byImpact);

  const quickWins = results
    .filter((r) => r.status === "weak" && !r._t.intentClash && r._best && r._best.allWordsOnPage && r._best.evidence === "content")
    .map((r) => {
      const b = r._best;
      const action = b.primary >= 0.5 && b.missingInPrimary.length
        ? `Add "${b.missingInPrimary.join(" ")}" to the title or H1 of ${b.path}.`
        : `Put "${r.keyword}" into the title or H1 of ${b.path}. The words are already on the page.`;
      return { keyword: r.keyword, page: b.path, action, effort: "low", impact: r.impact };
    })
    .sort(byImpact);

  const covered = results.filter((r) => r.status === "covered").length;
  const urlOnlyCovered = results.filter((r) => r.status === "covered" && r.evidence === "url-only").map((r) => r.keyword);
  const summary = {
    topics: results.length,
    skipped: skipped.length,
    pages: pages.length,
    pagesWithContent: pages.filter((p) => p.evidence === "content").length,
    pagesUrlOnly: pages.filter((p) => p.evidence === "url-only").length,
    covered,
    weak: results.filter((r) => r.status === "weak").length,
    missing: missing.length,
    coveragePct: results.length ? Math.round((covered / results.length) * 100) : 0,
    proposedPages: missingPages.length,
    overlaps: overlaps.length,
  };
  const topics = results.map(({ _t, _best, _scored, ...rest }) => rest).sort(byImpact);
  return { summary, topics, missingPages, weakMatches, quickWins, overlaps, urlOnlyCovered, skipped, settings: { coveredAt: cfg.coveredAt, weakAt: cfg.weakAt, language: cfg.language } };
}
