export type Stems = ReadonlyMap<string, string>;

const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "all", "also", "and", "any", "are", "because", "been", "being", "but", "can", "cannot", "could", "did",
  "does", "down", "each", "for", "from", "had", "has", "have", "hence", "here", "how", "into", "its",
  "itself", "just", "may", "might", "more", "most", "must", "nor", "not", "off", "one", "only", "onto",
  "other", "out", "over", "own", "same", "shall", "should", "some", "still", "such", "than", "that", "the",
  "their", "them", "then", "there", "therefore", "these", "they", "this", "those", "thus", "under", "very",
  "was", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "without", "would",
]);

const MINIMUM_LETTERS = 3;
const MINIMUM_STEM_LETTERS = 2;
const CAMEL_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const WORD_SEPARATOR = /[^a-z0-9]+/;
const BARE_NUMBER = /^\d+$/;

const PLURAL_RULES: readonly (readonly [RegExp, string])[] = [
  [/ie[sd]$/, "y"],
  [/(?<=ss|x|z|ch|sh)es$/, ""],
  [/(?<![siu])s$/, ""],
];
const INFLECTION = /(?:ing|ed)$/;
const DOUBLED_FINAL_CONSONANT = /([bcdfghjkmnpqrtvwxy])\1$/;
const TRAILING_E = /e$/;

const shortenedTo = (request: { readonly stem: string; readonly shortened: string; readonly floor: number }): string =>
  request.shortened.length >= request.floor ? request.shortened : request.stem;

const singularOf = (request: { readonly word: string }): string =>
  PLURAL_RULES.reduce(
    (stem, [suffix, replacement]) =>
      shortenedTo({ stem, shortened: stem.replace(suffix, replacement), floor: MINIMUM_LETTERS }),
    request.word,
  );

const uninflectedOf = (request: { readonly stem: string }): string => {
  if (!INFLECTION.test(request.stem)) {
    return request.stem;
  }
  const bare = shortenedTo({ stem: request.stem, shortened: request.stem.replace(INFLECTION, ""), floor: MINIMUM_STEM_LETTERS });
  return bare === request.stem ? bare : shortenedTo({ stem: bare, shortened: bare.replace(DOUBLED_FINAL_CONSONANT, "$1"), floor: MINIMUM_LETTERS });
};

const stemOf = (request: { readonly word: string }): string => {
  const stem = uninflectedOf({ stem: singularOf(request) });
  return shortenedTo({ stem, shortened: stem.replace(TRAILING_E, ""), floor: MINIMUM_STEM_LETTERS });
};

const isContentWord = (request: { readonly word: string }): boolean =>
  request.word.length >= MINIMUM_LETTERS && !FUNCTION_WORDS.has(request.word) && !BARE_NUMBER.test(request.word);

export const stemsOf = (request: { readonly text: string }): Stems => {
  const spellings = request.text
    .replace(CAMEL_CASE_BOUNDARY, "$1 $2")
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((word) => isContentWord({ word }))
    .map((word) => [stemOf({ word }), word] as const);
  return new Map(
    spellings.filter(([stem], position) => spellings.findIndex(([earlier]) => earlier === stem) === position),
  );
};

export const stemsShared = (request: { readonly left: Stems; readonly right: Stems }): Stems =>
  new Map([...request.left].filter(([stem]) => request.right.has(stem)));

export const stemsWithout = (request: { readonly stems: Stems; readonly excluded: readonly Stems[] }): Stems =>
  new Map([...request.stems].filter(([stem]) => request.excluded.every((excluded) => !excluded.has(stem))));

export const wordsOf = (request: { readonly stems: Stems }): readonly string[] => [...request.stems.values()];
