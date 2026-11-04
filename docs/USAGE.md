# Usage

Keyword Gap Analyzer compares a list of topics you want to be found for with the pages your site already has. It tells you which topics have no page, which have a page that only half fits, and which can be fixed by editing a title. It works from local files only. There is no network access and no paid SEO data in it.

## Install

Node 20 or newer. No dependencies, nothing to build.

```bash
git clone https://github.com/Kim-Like/keyword-gap-analyzer.git
cd keyword-gap-analyzer
npm test                 # optional, runs offline
npm link                 # optional, puts `keyword-gap` on your path
```

You can also run it without linking: `node bin/keyword-gap.mjs ...`.

## Inputs

**Topics** (`--topics`), CSV or JSON. Only `keyword` is required.

```csv
keyword,volume,priority,intent,group,target
bike repair,1900,high,,,
brake pad replacement,390,medium,transactional,,
kids bike repair,140,low,,,/kids-bikes
```

- `volume`: any number you trust, from your own search console, a spreadsheet or a guess. Leave it empty and every topic counts as 1.
- `priority`: `high`, `medium`, `low` (3, 2, 1) or a number.
- `intent`: `informational`, `commercial`, `transactional` or `navigational`. If empty, a guess is made from words such as "price", "best" and "how".
- `group`: topics with the same group value are proposed as one page if they are missing.
- `target`: a URL you already plan to use. The topic is then checked against that page only.
- JSON works too: an array of strings, an array of objects with the same keys, or `{"topics": [...]}`.

**Pages**, at least one of these three, and they can be combined:

- `--pages <file>`: CSV or JSON with `url`, and optionally `title`, `h1`, `description`, `headings` (an array, or a semicolon separated string in CSV) and `text`.
- `--pages-dir <folder>` with `--base <url>`: a folder of HTML files. Titles, the first H1, the meta description, H2 and H3 headings and the main text are read from the files.
- `--sitemap <file>`: a sitemap XML file on disk. Pages that appear only here are matched on their URL alone, and the report says so.

Pages from different sources are merged by path, so a sitemap entry and a page-list entry for the same URL become one page.

## Run

```bash
keyword-gap --topics topics.csv --pages pages.json --sitemap sitemap.xml
keyword-gap --topics topics.csv --pages-dir ./dist --base https://example.com --format markdown > gap.md
keyword-gap --topics topics.csv --pages pages.json --format csv > topics-with-status.csv
```

## Options

| Option | Meaning | Default |
| --- | --- | --- |
| `--topics <file>` | Topics CSV or JSON. | required |
| `--pages <file>` | Page list CSV or JSON. | none |
| `--sitemap <file>` | Local sitemap XML. | none |
| `--pages-dir <folder>` | Folder of HTML files. | none |
| `--base <url>` | Public address for `--pages-dir`. | `https://example.com` |
| `--config <file>` | JSON file with any option in camelCase (`topicsFile`, `pagesFile`, `coveredAt` and so on). Flags win. | none |
| `--format <f>` | `text`, `json`, `markdown` or `csv`. | `text` |
| `--language <l>` | `en`, `da` or `none`: stop words and plural endings. | `en` |
| `--covered-at <n>` | Score from which a topic counts as covered. | 0.9 |
| `--weak-at <n>` | Score from which a topic counts as weak instead of missing. | 0.45 |
| `--top <n>` | Rows per section in text output. | 10 |

## How a topic is judged

Each topic is split into words, stop words are dropped and plurals are trimmed lightly. Each page is scored against the topic:

- Title, H1 or URL path contain every word as the phrase: score 1.0. All the words but not as the phrase: 0.9. Part of the words: 0.85 times the share found.
- Headings or description contain the words: up to 0.7 times the share found.
- Body text contains the words: up to 0.45 times the share found.

The best page decides the status.

- **covered**: score at or above 0.9, and the page type does not clash with the topic.
- **weak**: score at or above 0.45 and every word of the topic appears somewhere on the page, or the score is high but the intent clashes.
- **missing**: below 0.45, or the best page does not contain all the words of the topic at all. A page about "bike repair" is not a page about "mobile bike repair".

Other things in the report:

- **Quick wins** are weak topics where every word is already on the best page, so a title or H1 edit may be enough. They are sorted by impact (volume times priority).
- **Missing pages** groups missing topics that share most of their words (or share a `group`) into one proposed page, with a suggested path. One page per cluster, not one per keyword.
- **Pages competing** lists topics that two or more pages both cover fully. Pick one page and point the other at it.
- **Intent clash** flags a purchase topic whose best page looks like an article, or a question whose best page looks like a sales page. The page type is guessed from the URL path and the title, so check these by eye.

## Example output

Run on the files in `fixtures/`: 14 topics, 9 pages in a page list and a sitemap that adds one more URL.

```text
$ keyword-gap --topics fixtures/topics.csv --pages fixtures/pages.json --sitemap fixtures/sitemap.xml
Keyword gap: 14 topics against 10 pages
Covered 6 (43%), weak 4, missing 4
1 pages had a URL but no content, so they were matched on the URL alone.

Missing pages (one page per cluster, not one per keyword)
 1. /mobile-bike-repair  impact 2030
    headline: "mobile bike repair", also: "mobile bike mechanic"
 2. /e-bike-battery-replacement  impact 640
    headline: "e-bike battery replacement"
 3. /kids-bikes  impact 140
    headline: "kids bike repair"
    note: this path was planned in the topics file but is not in the page list

Weak matches
 1. "bike repair cost"  best /pricing (0.57)  impact 2640
    Title, H1 and URL of /pricing cover 2 of 3 words. Missing there: cost.
 2. "best commuter bike"  best /blog/choosing-a-commuter-bike (0.57)  impact 2200
    Title, H1 and URL of /blog/choosing-a-commuter-bike cover 2 of 3 words. Missing there: best.
 3. "brake pad replacement"  best /blog/brake-pad-replacement-guide (1)  impact 780  INTENT
    "brake pad replacement" reads as transactional but the best page (/blog/brake-pad-replacement-guide) looks informational. A different kind of page is needed, not a new title.
 4. "bike storage"  best /about (0.45)  impact 210
    "bike storage" appears only in the body text of /about.

Quick wins (edit an existing page)
 1. "bike repair cost"  impact 2640
    Add "cost" to the title or H1 of /pricing.
 2. "best commuter bike"  impact 2200
    Add "best" to the title or H1 of /blog/choosing-a-commuter-bike.
 3. "bike storage"  impact 210
    Put "bike storage" into the title or H1 of /about. The words are already on the page.

Covered on the URL alone (no page content was given, check the pages)
  "wheel truing"

Pages competing for the same topic
  "bike repair": /, /pricing
  "bike repair near me": /, /pricing
```

The JSON output (`--format json`) has `summary`, `topics`, `missingPages`, `weakMatches`, `quickWins`, `overlaps`, `urlOnlyCovered` and `settings`. Each entry in `topics` has its status, score, best page, the reasons and the three closest pages.

## Use it as a library

```js
import { analyze, loadInputs, toText } from "./src/index.mjs";

const { topics, pages } = await loadInputs({ topicsFile: "topics.csv", pagesFile: "pages.json" });
console.log(toText(analyze(topics, pages)));
```

## When NOT to use this

- It does not know what people search for or how hard a phrase is to rank for. The volumes are whatever you type in. If you need to choose which topics to target, do that first, elsewhere.
- It matches words, not meaning. A page that answers a question without using the words will show as missing. Synonyms are not understood. "Repair" and "fix" are different words to it.
- The stemming is rough: plural endings only. Languages with heavy compounding or inflection will match less well, and the Danish mode is a light approximation.
- The intent guess is a handful of word and path rules. Treat an intent flag as a prompt to look, not a verdict.
- "near" and "me" are ignored as words, so "bike repair near me" is judged like "bike repair". Local pages need their own thinking.
- Pages with a URL and nothing else can only be matched on the URL. The report labels those, and you should not trust them without a look.
- Do not turn the missing pages list into a publishing plan. A topic list is not a reason to publish a page for every row. Merge close topics, publish few pages, and only when you have something real to say.
- Below ten or so topics, or a site of a few pages, a spreadsheet and an hour of reading is faster.
