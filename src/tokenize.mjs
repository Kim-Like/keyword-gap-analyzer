const EN = "a an and are as at be but by do does for from how i in is it of on or our the to we what when where which who why with you your me my can should near".split(" ");
const DA = "af alle at de den der det du en er et for fra har hvad hvem hvor hvordan hvorfor i jeg kan med mig min og om på til som skal vi være din dit dine ved".split(" ");

export const STOPWORDS = { en: new Set(EN), da: new Set(DA), none: new Set() };

// A light stemmer, applied the same way to topics and pages so they meet in the
// middle. It is rough on purpose: plural endings only.
export function stem(word, language = "en") {
  let w = word;
  if (language === "da") {
    if (w.length > 6 && w.endsWith("erne")) return w.slice(0, -4);
    if (w.length > 5 && w.endsWith("ene")) return w.slice(0, -3);
    if (w.length > 4 && /(er|en|et)$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && w.endsWith("e")) return w.slice(0, -1);
    return w;
  }
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("sses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function words(text) {
  return String(text || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export function tokenize(text, { language = "en", stopwords } = {}) {
  const stop = stopwords || STOPWORDS[language] || STOPWORDS.en;
  return words(text)
    .filter((w) => !stop.has(w) && (w.length > 1 || /\d/.test(w)))
    .map((w) => stem(w, language));
}

export function slugify(text) {
  return words(text).join("-");
}
