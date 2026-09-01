const search = new Intl.Collator(undefined, { usage: "search", sensitivity: "accent" });

/** The first case-insensitive match of a non-blank phrase inside its headline. */
export function findEmphasis(headline: string, phrase: string | undefined) {
  const needle = phrase?.trim();
  if (!needle) return null;
  for (let start = 0; start <= headline.length - needle.length; start++) {
    if (search.compare(headline.slice(start, start + needle.length), needle) === 0) {
      return { start, end: start + needle.length };
    }
  }
  return null;
}
