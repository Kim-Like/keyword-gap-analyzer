import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../src/csv.mjs";
import { tokenize, stem, slugify } from "../src/tokenize.mjs";

test("csv: quotes, doubled quotes and newlines in fields", () => {
  const rows = parseCsv('keyword,notes\n"a, b","say ""hi"""\nplain,"two\nlines"\n');
  assert.deepEqual(rows, [{ keyword: "a, b", notes: 'say "hi"' }, { keyword: "plain", notes: "two\nlines" }]);
});

test("csv: semicolon and tab delimiters are detected, headers normalised", () => {
  assert.deepEqual(parseCsv("Keyword;Target URL\nx;/y"), [{ keyword: "x", target_url: "/y" }]);
  assert.deepEqual(parseCsv("keyword\tvolume\nx\t5"), [{ keyword: "x", volume: "5" }]);
});

test("csv: BOM and blank lines are ignored, round trip through toCsv", () => {
  const rows = parseCsv("﻿keyword,volume\n\nx,1\n");
  assert.deepEqual(rows, [{ keyword: "x", volume: "1" }]);
  assert.equal(toCsv([{ a: 'q"1', b: "x,y" }], ["a", "b"]), 'a,b\n"q""1","x,y"\n');
});

test("tokenize drops stop words and stems plurals", () => {
  assert.deepEqual(tokenize("How to fix the flat tyres"), ["fix", "flat", "tyre"]);
  assert.equal(stem("batteries"), "battery");
  assert.equal(stem("glass"), "glass");
  assert.equal(stem("bus"), "bus");
});

test("tokenize keeps unicode letters and digits, drops single letters", () => {
  assert.deepEqual(tokenize("e-bike 2024 blåbær", { language: "none" }), ["bike", "2024", "blåbær"]);
});

test("danish mode removes danish stop words and plural endings", () => {
  assert.deepEqual(tokenize("hvordan vælger man cykler", { language: "da" }), ["vælg", "man", "cykl"]);
});

test("slugify", () => {
  assert.equal(slugify("E-bike battery, replaced!"), "e-bike-battery-replaced");
});
