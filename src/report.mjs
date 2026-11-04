import { toCsv } from "./csv.mjs";

const num = (n) => (n === null || n === undefined ? "-" : String(n));

export function toText(r, { top = 10 } = {}) {
  const s = r.summary;
  const out = [];
  out.push(`Keyword gap: ${s.topics} topics against ${s.pages} pages`);
  out.push(`Covered ${s.covered} (${s.coveragePct}%), weak ${s.weak}, missing ${s.missing}`);
  if (s.pagesUrlOnly) out.push(`${s.pagesUrlOnly} pages had a URL but no content, so they were matched on the URL alone.`);
  if (s.skipped) out.push(`${s.skipped} topics skipped (only stop words).`);

  out.push("", `Missing pages (one page per cluster, not one per keyword)`);
  if (!r.missingPages.length) out.push("  none");
  r.missingPages.slice(0, top).forEach((m, i) => {
    out.push(`${String(i + 1).padStart(2)}. ${m.suggestedPath}  ${m.intent === "unknown" ? "" : `[${m.intent}]  `}impact ${m.impact}`);
    out.push(`    headline: "${m.headline}"${m.keywords.length > 1 ? `, also: ${m.keywords.slice(1).map((k) => `"${k}"`).join(", ")}` : ""}`);
    if (m.planned) out.push("    note: this path was planned in the topics file but is not in the page list");
    if (m.slugTaken) out.push(`    note: ${m.suggestedPath} already exists, pick another path`);
  });

  out.push("", "Weak matches");
  if (!r.weakMatches.length) out.push("  none");
  r.weakMatches.slice(0, top).forEach((w, i) => {
    out.push(`${String(i + 1).padStart(2)}. "${w.keyword}"  best ${w.bestPage} (${w.score})  impact ${w.impact}${w.intentClash ? "  INTENT" : ""}`);
    out.push(`    ${w.reason}`);
  });

  out.push("", "Quick wins (edit an existing page)");
  if (!r.quickWins.length) out.push("  none");
  r.quickWins.slice(0, top).forEach((q, i) => {
    out.push(`${String(i + 1).padStart(2)}. "${q.keyword}"  impact ${q.impact}`);
    out.push(`    ${q.action}`);
  });

  if (r.urlOnlyCovered.length) {
    out.push("", "Covered on the URL alone (no page content was given, check the pages)");
    r.urlOnlyCovered.forEach((k) => out.push(`  "${k}"`));
  }

  if (r.overlaps.length) {
    out.push("", "Pages competing for the same topic");
    r.overlaps.slice(0, top).forEach((o) => out.push(`  "${o.keyword}": ${o.pages.join(", ")}`));
  }
  return out.join("\n") + "\n";
}

export function toMarkdown(r) {
  const s = r.summary;
  const out = [`# Keyword gap`, "", `${s.topics} topics, ${s.pages} pages. Covered ${s.covered} (${s.coveragePct}%), weak ${s.weak}, missing ${s.missing}.`, ""];
  out.push("## Missing pages", "", "| Path | Headline | Also covers | Impact |", "| --- | --- | --- | --- |");
  for (const m of r.missingPages) out.push(`| ${m.suggestedPath} | ${m.headline} | ${m.keywords.slice(1).join(", ") || "-"} | ${m.impact} |`);
  out.push("", "## Weak matches", "", "| Keyword | Best page | Score | Why |", "| --- | --- | --- | --- |");
  for (const w of r.weakMatches) out.push(`| ${w.keyword} | ${w.bestPage} | ${w.score} | ${w.reason} |`);
  out.push("", "## Quick wins", "", "| Keyword | Action | Impact |", "| --- | --- | --- |");
  for (const q of r.quickWins) out.push(`| ${q.keyword} | ${q.action} | ${q.impact} |`);
  return out.join("\n") + "\n";
}

export function toCsvReport(r) {
  return toCsv(
    r.topics.map((t) => ({ ...t, volume: num(t.volume), bestPage: t.bestPage || "", reasons: t.reasons.join(" ") })),
    ["keyword", "status", "intent", "volume", "priority", "impact", "score", "bestPage", "reasons"]
  );
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + "\n";
}
