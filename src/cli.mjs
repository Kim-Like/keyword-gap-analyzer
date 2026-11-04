import { readFile } from "node:fs/promises";
import { analyze, loadInputs, toText, toMarkdown, toCsvReport, toJson } from "./index.mjs";

const HELP = `keyword-gap --topics <file> [--pages <file>] [--sitemap <file>] [--pages-dir <folder>] [options]

Compare target topics with the pages a site has. No network, no paid data.

Inputs
  --topics <file>     CSV or JSON. Needs a keyword column. Optional: intent, volume,
                      priority (high, medium, low or a number), group, target.
  --pages <file>      CSV or JSON page list: url, title, h1, description, headings, text.
  --sitemap <file>    Local sitemap XML. Pages found only here are matched on their URL.
  --pages-dir <dir>   Folder of HTML files to read titles, headings and text from.
  --base <url>        Public address for --pages-dir (default https://example.com).
  --config <file>     JSON file with any option below in camelCase.

Options
  --format <f>        text, json, markdown or csv (default text).
  --language <l>      en, da or none (stop words and plural rules, default en).
  --covered-at <n>    Score that counts as covered (default 0.9).
  --weak-at <n>       Score that counts as weak instead of missing (default 0.45).
  --top <n>           Rows per section in text output (default 10).
  --help              Show this text.
`;

const STRINGS = { topics: "topicsFile", pages: "pagesFile", sitemap: "sitemapFile", "pages-dir": "pagesDir", base: "base", config: "config", format: "format", language: "language" };
const NUMBERS = { "covered-at": "coveredAt", "weak-at": "weakAt", top: "top" };

export function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}`);
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    if (key === "help") {
      opts.help = true;
      continue;
    }
    if (!(key in STRINGS) && !(key in NUMBERS)) throw new Error(`unknown option --${key}`);
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) throw new Error(`--${key} needs a value`);
    if (key in NUMBERS) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error(`--${key} needs a non-negative number`);
      opts[NUMBERS[key]] = n;
    } else opts[STRINGS[key]] = value;
  }
  return opts;
}

export async function main(argv, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }) {
  const cli = parseArgs(argv);
  if (cli.help) {
    io.out(HELP);
    return 0;
  }
  const file = cli.config ? JSON.parse(await readFile(cli.config, "utf8")) : {};
  const opts = { format: "text", top: 10, language: "en", ...file, ...cli };
  if (!opts.topicsFile) {
    io.err(HELP);
    return 1;
  }
  const { topics, pages } = await loadInputs(opts);
  const report = analyze(topics, pages, { language: opts.language, coveredAt: opts.coveredAt, weakAt: opts.weakAt });
  const f = opts.format;
  if (f === "json") io.out(toJson(report));
  else if (f === "markdown") io.out(toMarkdown(report));
  else if (f === "csv") io.out(toCsvReport(report));
  else if (f === "text") io.out(toText(report, { top: opts.top }));
  else throw new Error(`unknown --format ${f}`);
  return 0;
}
