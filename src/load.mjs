import { readFile, readdir, stat } from "node:fs/promises";
import * as path from "node:path";
import { parseCsv } from "./csv.mjs";
import { parseHtml, metaContent } from "./html.mjs";

const PRIORITY = { high: 3, medium: 2, low: 1 };

function pick(obj, names) {
  for (const n of names) if (obj[n] !== undefined && obj[n] !== "") return obj[n];
  return undefined;
}

function toNumber(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parseTopics(text, fileName = "topics.csv") {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.topics;
    if (!Array.isArray(list)) throw new Error("topics JSON must be an array or an object with a topics array");
    rows = list.map((t) => (typeof t === "string" ? { keyword: t } : lowerKeys(t)));
  } else {
    rows = parseCsv(text);
  }
  const topics = [];
  for (const r of rows) {
    const keyword = pick(r, ["keyword", "topic", "query", "term"]);
    if (!keyword) continue;
    const p = pick(r, ["priority"]);
    const priority = PRIORITY[String(p || "").toLowerCase()] ?? toNumber(p) ?? 1;
    topics.push({
      keyword: String(keyword).trim(),
      intent: (pick(r, ["intent"]) || "").toString().toLowerCase() || undefined,
      volume: toNumber(pick(r, ["volume", "searches"])),
      priority,
      group: pick(r, ["group", "cluster"]),
      target: pick(r, ["target", "target_url", "url"]),
    });
  }
  if (!topics.length) throw new Error("no topics found; the file needs a keyword column (or a JSON array of strings)");
  return topics;
}

function lowerKeys(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
}

export function pathKey(url) {
  let p;
  try {
    p = new URL(url, "https://placeholder.invalid").pathname;
  } catch {
    p = String(url);
  }
  p = p.replace(/\/index\.html?$/i, "/").replace(/\.html?$/i, "");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

export function parsePages(text, fileName = "pages.json") {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.pages;
    if (!Array.isArray(list)) throw new Error("pages JSON must be an array or an object with a pages array");
    rows = list.map((p) => (typeof p === "string" ? { url: p } : lowerKeys(p)));
  } else rows = parseCsv(text);
  return rows
    .filter((r) => r.url)
    .map((r) => ({
      url: String(r.url).trim(),
      title: r.title || "",
      h1: r.h1 || "",
      description: r.description || r.meta_description || "",
      headings: Array.isArray(r.headings) ? r.headings : String(r.headings || "").split(/\s*;\s*/).filter(Boolean),
      text: r.text || r.body || "",
    }));
}

export function parseSitemapUrls(xml) {
  const urls = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) urls.push(m[1].trim());
  return urls;
}

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else if (/\.html?$/i.test(name)) out.push(full);
  }
  return out;
}

export async function loadPagesFromDir(dir, base = "https://example.com") {
  const root = path.resolve(dir);
  const pages = [];
  for (const file of (await walk(root)).sort()) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const parsed = parseHtml(await readFile(file, "utf8"));
    const h1 = parsed.headings.find((h) => h.level === 1);
    pages.push({
      url: new URL("/" + rel, base).toString(),
      title: parsed.title || "",
      h1: h1 ? h1.text : "",
      description: metaContent(parsed, "description") || "",
      headings: parsed.headings.filter((h) => h.level >= 2 && h.level <= 3).map((h) => h.text),
      text: parsed.mainText,
    });
  }
  return pages;
}

// Merge every page source by path. Content fields from richer sources win over URL-only entries.
export function mergePages(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const p of list) {
      const key = pathKey(p.url);
      const prev = byKey.get(key);
      if (!prev) byKey.set(key, { ...p, headings: p.headings || [] });
      else {
        for (const f of ["title", "h1", "description", "text"]) if (!prev[f] && p[f]) prev[f] = p[f];
        if ((!prev.headings || !prev.headings.length) && p.headings && p.headings.length) prev.headings = p.headings;
      }
    }
  }
  return [...byKey.values()];
}

export async function loadInputs({ topicsFile, pagesFile, sitemapFile, pagesDir, base }) {
  if (!topicsFile) throw new Error("--topics is required");
  const topics = parseTopics(await readFile(topicsFile, "utf8"), topicsFile);
  const lists = [];
  if (pagesFile) lists.push(parsePages(await readFile(pagesFile, "utf8"), pagesFile));
  if (pagesDir) lists.push(await loadPagesFromDir(pagesDir, base));
  if (sitemapFile) lists.push(parseSitemapUrls(await readFile(sitemapFile, "utf8")).map((url) => ({ url, title: "", h1: "", description: "", headings: [], text: "" })));
  if (!lists.length) throw new Error("give at least one of --pages, --pages-dir or --sitemap");
  return { topics, pages: mergePages(...lists) };
}
