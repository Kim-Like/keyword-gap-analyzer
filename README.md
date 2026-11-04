# Keyword Gap Analyzer

Most SEO backlogs are not strategy problems. Someone made a list of topics a year ago, the site grew a few pages, nobody went back, and now no one can say which topics have a page, which have a page that only half fits, and which have nothing. The list and the site drift apart because mapping one to the other is dull work.

Keyword Gap Analyzer does that mapping from files on disk. You give it a CSV or JSON of the topics you want to be found for, and a page list, a sitemap, or a folder of HTML files. It scores every topic against every page (title, H1 and URL count most, then headings and description, then body text) and sorts the result into three piles: topics that need a page, topics whose best page is a weak match or the wrong kind of page, and quick wins where the words are already on a page and a title edit may be enough. Missing topics that share most of their words are grouped into one proposed page, because one page per keyword is how sites end up with a pile of near-duplicates. It also lists topics that two of your own pages both claim.

It uses no network and no paid data. Search volume is whatever number you put in the file. It matches words, not meaning, the intent guess is a handful of rules, and the stemming is rough. The usage notes say where it is wrong, and I would rather you know that before you trust it.

Quick start:

```bash
git clone https://github.com/Kim-Like/keyword-gap-analyzer.git
cd keyword-gap-analyzer
node bin/keyword-gap.mjs --topics fixtures/topics.csv --pages fixtures/pages.json --sitemap fixtures/sitemap.xml
node bin/keyword-gap.mjs --topics topics.csv --pages-dir ./dist --base https://example.com --format markdown
```

Input formats, options, the scoring rules, example output and when not to use it are in [docs/USAGE.md](./docs/USAGE.md).

I build and run automation for small teams at [aienterprise.dk](https://aienterprise.dk). This tool is what I use before deciding what to write next, and just as often to decide what not to write.

## What it does

Compares a site's target topics against page coverage and outputs missing pages, weak intent matches, and quick wins.

## Install and use

See the files in this repository for the current runnable shape. This tool was rebuilt from scratch as a generic public utility, not copied from a production system.

## License

MIT. See [LICENSE](./LICENSE).

## Author

Kim Like, https://aienterprise.dk
