import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { parseArgs } from "../src/cli.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "bin", "keyword-gap.mjs");
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", cwd: root });
const base = ["--topics", "fixtures/topics.csv", "--pages", "fixtures/pages.json"];

test("text report", () => {
  const r = cli(...base, "--sitemap", "fixtures/sitemap.xml");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Keyword gap: 14 topics against 10 pages/);
  assert.match(r.stdout, /Quick wins/);
});

test("json report parses", () => {
  const r = cli(...base, "--format", "json");
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.summary.topics, 14);
});

test("csv report", () => {
  const r = cli(...base, "--format", "csv");
  assert.match(r.stdout.split("\n")[0], /^keyword,status/);
});

test("pages from a folder", () => {
  const r = cli("--topics", "fixtures/topics.csv", "--pages-dir", "fixtures/site", "--base", "https://example.com");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /against 3 pages/);
});

test("config file", () => {
  const r = cli("--config", "fixtures/config.json");
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).summary.pages, 9);
});

test("errors exit 1 with a message", () => {
  assert.equal(cli().status, 1);
  const r = cli("--topics", "fixtures/topics.csv");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /at least one of/);
  assert.equal(cli("--wat").status, 1);
});

test("parseArgs", () => {
  const o = parseArgs(["--topics=t.csv", "--covered-at", "0.8", "--language", "da"]);
  assert.deepEqual(o, { topicsFile: "t.csv", coveredAt: 0.8, language: "da" });
});
