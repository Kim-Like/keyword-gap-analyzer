// A small tolerant HTML reader. It is not a spec-compliant parser. It pulls out
// the handful of signals a first-pass site audit needs and ignores the rest.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const v = ENTITIES[e.toLowerCase()];
    return v === undefined ? match : v;
  });
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

const collapse = (s) => decodeEntities(s).replace(/\s+/g, " ").trim();
const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const RAW_TEXT = new Set(["script", "style", "title", "textarea"]);
const HEADING = /^h[1-6]$/;

export function parseHtml(html) {
  const out = {
    lang: null,
    title: null,
    metas: [],
    links: [],
    anchors: [],
    headings: [],
    images: [],
    resources: [],
    jsonLd: [],
    jsonLdErrors: 0,
    canonical: null,
    bodyText: "",
    mainText: "",
  };
  const lower = html.toLowerCase();
  let inHead = false;
  let mainDepth = 0;
  let heading = null;
  let anchor = null;
  let body = "";
  let main = "";
  TAG_RE.lastIndex = 0;
  let last = 0;
  let m;

  const addText = (t) => {
    if (!t) return;
    if (!inHead) {
      body += t;
      if (mainDepth > 0) main += t;
    }
    if (heading) heading.buf += t;
    if (anchor) anchor.buf += t;
  };

  while ((m = TAG_RE.exec(html))) {
    addText(html.slice(last, m.index));
    last = TAG_RE.lastIndex;
    if (!m[2]) continue; // comment or CDATA
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const attrs = closing ? {} : parseAttrs(m[3]);
    const selfClosed = /\/\s*$/.test(m[3]);
    addText(" ");

    if (!closing && RAW_TEXT.has(name) && !selfClosed) {
      const end = lower.indexOf("</" + name, TAG_RE.lastIndex);
      const stop = end === -1 ? html.length : end;
      const content = html.slice(TAG_RE.lastIndex, stop);
      const after = end === -1 ? html.length : lower.indexOf(">", end) + 1 || html.length;
      TAG_RE.lastIndex = after;
      last = after;
      if (name === "title" && out.title === null) out.title = collapse(content);
      if (name === "script") {
        if (attrs.src) out.resources.push({ tag: "script", url: attrs.src });
        if ((attrs.type || "").toLowerCase().includes("ld+json")) {
          try {
            out.jsonLd.push(JSON.parse(content));
          } catch {
            out.jsonLdErrors += 1;
          }
        }
      }
      continue;
    }

    if (closing) {
      if (HEADING.test(name) && heading) {
        out.headings.push({ level: Number(name[1]), text: collapse(heading.buf) });
        heading = null;
      } else if (name === "a" && anchor) {
        out.anchors.push({ href: anchor.href, text: collapse(anchor.buf) });
        anchor = null;
      } else if (name === "main" || name === "article") {
        mainDepth = Math.max(0, mainDepth - 1);
      } else if (name === "head") {
        inHead = false;
      }
      continue;
    }

    switch (name) {
      case "html":
        if (attrs.lang !== undefined) out.lang = attrs.lang.trim() || null;
        break;
      case "head":
        inHead = true;
        break;
      case "body":
        inHead = false;
        break;
      case "meta":
        out.metas.push(attrs);
        break;
      case "link":
        out.links.push(attrs);
        if ((attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical") && attrs.href && out.canonical === null) {
          out.canonical = attrs.href.trim();
        }
        if ((attrs.rel || "").toLowerCase().includes("stylesheet") && attrs.href) {
          out.resources.push({ tag: "link", url: attrs.href });
        }
        break;
      case "img":
        out.images.push({ src: attrs.src || "", hasAlt: "alt" in attrs, alt: attrs.alt || "" });
        if (attrs.src) out.resources.push({ tag: "img", url: attrs.src });
        break;
      case "iframe":
      case "video":
      case "audio":
        if (attrs.src) out.resources.push({ tag: name, url: attrs.src });
        break;
      case "main":
      case "article":
        if (!selfClosed) mainDepth += 1;
        break;
      case "a":
        if (attrs.href !== undefined) anchor = { href: attrs.href, buf: "" };
        break;
      default:
        if (HEADING.test(name)) heading = { buf: "" };
    }
  }
  addText(html.slice(last));
  out.bodyText = collapse(body);
  out.mainText = collapse(main) || out.bodyText;
  return out;
}

export function metaContent(parsed, key) {
  const k = key.toLowerCase();
  for (const meta of parsed.metas) {
    const name = (meta.name || meta.property || "").toLowerCase();
    if (name === k && meta.content !== undefined) return meta.content.trim();
  }
  return null;
}

export function countWords(text) {
  const found = text.match(/[\p{L}\p{N}]+/gu);
  return found ? found.length : 0;
}
