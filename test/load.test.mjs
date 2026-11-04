import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { parseTopics, parsePages, parseSitemapUrls, mergePages, pathKey, loadPagesFromDir, loadInputs } from "../src/load.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

test("topics from CSV with volume, priority words and target", () => {
  const t = parseTopics("keyword,volume,priority,target\nbike repair,\"1,900\",high,/repair\nbike storage,,low,\n");
  assert.equal(t[0].volume, 1900);
  assert.equal(t[0].priority, 3);
  assert.equal(t[0].target, "/repair");
  assert.equal(t[1].volume, undefined);
  assert.equal(t[1].priority, 1);
});

test("topics from JSON: strings, objects, and a wrapper object", () => {
  assert.equal(parseTopics('["a b","c d"]', "t.json").length, 2);
  assert.equal(parseTopics('{"topics":[{"Keyword":"x","Volume":5}]}', "t.json")[0].volume, 5);
});

test("topics file with no keyword column is a clear error", () => {
  assert.throws(() => parseTopics("name\nx\n"), /no topics found/);
});

test("pages from JSON and CSV share one shape", () => {
  const a = parsePages('[{"url":"/a","title":"A","headings":["h2 one","h2 two"]}]', "p.json")[0];
  assert.deepEqual(a.headings, ["h2 one", "h2 two"]);
  const b = parsePages("url,title,headings\n/b,B,one; two\n", "p.csv")[0];
  assert.deepEqual(b.headings, ["one", "two"]);
});

test("sitemap urls", () => {
  assert.deepEqual(parseSitemapUrls("<urlset><url><loc>https://example.com/a</loc></url></urlset>"), ["https://example.com/a"]);
});

test("pathKey ignores origin, trailing slash and html extension", () => {
  assert.equal(pathKey("https://example.com/a/"), "/a");
  assert.equal(pathKey("/blog/index.html"), "/blog");
  assert.equal(pathKey("/x.html"), "/x");
  assert.equal(pathKey("https://example.com"), "/");
});

test("mergePages lets content fill a URL-only entry from the sitemap", () => {
  const merged = mergePages(
    [{ url: "https://example.com/a", title: "", h1: "", description: "", headings: [], text: "" }],
    [{ url: "/a/", title: "Title A", h1: "H", description: "", headings: [], text: "body" }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, "Title A");
});

test("pages from a folder of HTML", async () => {
  const pages = await loadPagesFromDir(path.join(fixtures, "site"), "https://example.com");
  const flat = pages.find((p) => p.url.endsWith("how-to-fix-a-flat-tyre.html"));
  assert.equal(flat.title, "How to fix a flat tyre");
  assert.equal(flat.h1, "How to fix a flat tyre");
  assert.deepEqual(flat.headings, ["Tools you need"]);
  assert.equal(pages.length, 3);
});

test("loadInputs needs a topics file and at least one page source", async () => {
  await assert.rejects(loadInputs({ pagesFile: path.join(fixtures, "pages.json") }), /--topics is required/);
  await assert.rejects(loadInputs({ topicsFile: path.join(fixtures, "topics.csv") }), /at least one of/);
});
