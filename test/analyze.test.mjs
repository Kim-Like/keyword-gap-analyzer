import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { analyze, loadInputs, parseTopics, toText, toCsvReport, toMarkdown, topicIntent, pageIntent, intentMismatch } from "../src/index.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const run = async (options) => {
  const inputs = await loadInputs({
    topicsFile: path.join(fixtures, "topics.csv"),
    pagesFile: path.join(fixtures, "pages.json"),
    sitemapFile: path.join(fixtures, "sitemap.xml"),
  });
  return analyze(inputs.topics, inputs.pages, options);
};
const status = (r, kw) => r.topics.find((t) => t.keyword === kw);

test("covered topics have the phrase in title, H1 or URL", async () => {
  const r = await run();
  for (const kw of ["bike repair", "basic bike service", "electric bike service", "how to fix a flat tyre"]) {
    assert.equal(status(r, kw).status, "covered", kw);
  }
  assert.equal(status(r, "basic bike service").bestPage, "/services/basic-service");
});

test("a missing word on the page makes it missing, not weak", async () => {
  const r = await run();
  assert.equal(status(r, "mobile bike repair").status, "missing");
  assert.match(status(r, "mobile bike repair").reasons.join(" "), /needs its own page/);
});

test("weak: words in the page, not in the title", async () => {
  const r = await run();
  const cost = status(r, "bike repair cost");
  assert.equal(cost.status, "weak");
  assert.equal(cost.bestPage, "/pricing");
  const storage = status(r, "bike storage");
  assert.equal(storage.status, "weak");
  assert.match(storage.reasons.join(" "), /only in the body text/);
});

test("intent clash: a transactional topic on an article is weak even at full score", async () => {
  const r = await run();
  const brake = status(r, "brake pad replacement");
  assert.equal(brake.score, 1);
  assert.equal(brake.status, "weak");
  assert.equal(r.weakMatches.find((w) => w.keyword === "brake pad replacement").intentClash, true);
  assert.ok(!r.quickWins.some((q) => q.keyword === "brake pad replacement"));
});

test("quick wins name the missing word and the page to edit", async () => {
  const r = await run();
  const win = r.quickWins.find((q) => q.keyword === "bike repair cost");
  assert.equal(win.page, "/pricing");
  assert.match(win.action, /Add "cost"/);
});

test("missing topics cluster into one proposed page", async () => {
  const r = await run();
  const mobile = r.missingPages.find((m) => m.headline === "mobile bike repair");
  assert.deepEqual(mobile.keywords, ["mobile bike repair", "mobile bike mechanic"]);
  assert.equal(mobile.suggestedPath, "/mobile-bike-repair");
  assert.equal(r.missingPages.some((m) => m.keywords.includes("e-bike battery replacement") && m.keywords.length > 1), false);
});

test("a planned target URL that is not in the page list is flagged and not clustered", async () => {
  const r = await run();
  const kids = r.missingPages.find((m) => m.keywords.includes("kids bike repair"));
  assert.equal(kids.suggestedPath, "/kids-bikes");
  assert.equal(kids.planned, true);
  assert.deepEqual(kids.keywords, ["kids bike repair"]);
});

test("URL-only pages from a sitemap count as covered but are labelled", async () => {
  const r = await run();
  assert.equal(status(r, "wheel truing").status, "covered");
  assert.equal(status(r, "wheel truing").evidence, "url-only");
  assert.deepEqual(r.urlOnlyCovered, ["wheel truing"]);
});

test("two pages that both match a topic are reported as an overlap", async () => {
  const r = await run();
  const o = r.overlaps.find((x) => x.keyword === "bike repair");
  assert.deepEqual(o.pages.sort(), ["/", "/pricing"]);
});

test("summary adds up", async () => {
  const r = await run();
  const s = r.summary;
  assert.equal(s.covered + s.weak + s.missing, s.topics);
  assert.equal(s.topics, 14);
  assert.equal(s.pages, 10);
  assert.equal(s.coveragePct, Math.round((s.covered / s.topics) * 100));
});

test("thresholds move topics between statuses", async () => {
  const strict = await run({ coveredAt: 1.01 });
  assert.equal(strict.summary.covered, 0);
  const loose = await run({ weakAt: 0.2 });
  assert.ok(loose.summary.missing < (await run()).summary.missing + 1);
});

test("impact is volume times priority, and lists sort by it", async () => {
  const r = await run();
  assert.equal(status(r, "bike repair cost").impact, 880 * 3);
  for (let i = 1; i < r.weakMatches.length; i += 1) assert.ok(r.weakMatches[i - 1].impact >= r.weakMatches[i].impact);
});

test("a topic made only of stop words is skipped, not crashed on", () => {
  const r = analyze([{ keyword: "how to" }, { keyword: "bike" }], [{ url: "/bike", title: "Bike" }]);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.summary.topics, 1);
});

test("no pages at all means everything is missing", () => {
  const r = analyze([{ keyword: "bike repair" }], []);
  assert.equal(r.topics[0].status, "missing");
  assert.equal(r.missingPages.length, 1);
});

test("intent heuristics", () => {
  assert.equal(topicIntent("bike repair cost"), "transactional");
  assert.equal(topicIntent("best bike lights"), "commercial");
  assert.equal(topicIntent("how to true a wheel"), "informational");
  assert.equal(topicIntent("bike repair", "informational"), "informational");
  assert.equal(pageIntent("/blog/x", ""), "informational");
  assert.equal(pageIntent("/pricing", ""), "transactional");
  assert.equal(intentMismatch("transactional", "informational"), true);
  assert.equal(intentMismatch("commercial", "informational"), false);
  assert.equal(intentMismatch("unknown", "informational"), false);
});

test("output formats", async () => {
  const r = await run();
  assert.match(toText(r), /Missing pages/);
  assert.match(toMarkdown(r), /## Quick wins/);
  const csv = toCsvReport(r).split("\n");
  assert.equal(csv[0], "keyword,status,intent,volume,priority,impact,score,bestPage,reasons");
  assert.equal(csv.length, 14 + 2);
});

test("danish topics match danish pages", () => {
  const topics = parseTopics("keyword\ncykelreparation priser\n");
  const r = analyze(topics, [{ url: "/priser/cykelreparation", title: "Priser på cykelreparation" }], { language: "da" });
  assert.equal(r.topics[0].status, "covered");
});

test("the fixture topic file is readable as the CLI would read it", async () => {
  const text = await readFile(path.join(fixtures, "topics.csv"), "utf8");
  assert.equal(parseTopics(text, "topics.csv").length, 14);
});
