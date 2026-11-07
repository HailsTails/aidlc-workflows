export type Stems = ReadonlyMap<string, string>;

const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "about", "above", "across", "after", "again", "against", "ago", "all", "almost", "along", "already", "also",
  "although", "always", "amid", "among", "and", "another", "any", "anybody", "anyone", "anything", "anyway",
  "are", "around", "away", "because", "been", "before", "behind", "being", "below", "beneath", "beside",
  "besides", "between", "beyond", "both", "but", "can", "cannot", "could", "despite", "did", "does", "doing",
  "done", "down", "during", "each", "either", "else", "enough", "even", "ever", "every", "everybody",
  "everyone", "everything", "except", "few", "for", "from", "had", "has", "have", "having", "hence", "her",
  "here", "hers", "herself", "him", "himself", "his", "how", "however", "including", "inside", "instead",
  "into", "its", "itself", "just", "less", "like", "many", "may", "maybe", "might", "mine", "more", "most",
  "much", "must", "myself", "near", "neither", "never", "next", "nobody", "none", "nor", "not", "nothing",
  "now", "off", "often", "once", "one", "only", "onto", "other", "others", "otherwise", "our", "ours",
  "ourselves", "out", "outside", "over", "own", "per", "perhaps", "quite", "rather", "really", "same", "she",
  "shall", "should", "since", "some", "somebody", "someone", "something", "soon", "still", "such", "than",
  "that", "the", "their", "theirs", "them", "themselves", "then", "there", "therefore", "these", "they",
  "this", "those", "though", "through", "throughout", "thus", "too", "toward", "towards", "under", "unless",
  "until", "upon", "very", "via", "was", "were", "what", "whatever", "when", "whenever", "where", "whereas",
  "whether", "which", "while", "who", "whoever", "whom", "whose", "why", "will", "with", "within", "without",
  "would", "yet", "you", "your", "yours", "yourself", "yourselves",
]);

const MINIMUM_LETTERS = 3;
const MINIMUM_STEM_LETTERS = 2;
const NEGATIVE_CONTRACTION = /n['’]t\b/gi;
const CAMEL_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const WORD_SEPARATOR = /[^a-z0-9]+/;
const BARE_NUMBER = /^\d+$/;

const PLURAL_RULES: readonly (readonly [RegExp, string])[] = [
  [/ie[sd]$/, "y"],
  [/(?<=ss|x|z|ch|sh)es$/, ""],
  [/(?<![siu])s$/, ""],
];
const INFLECTION = /(?:ing|(?<!e)ed)$/;
const DOUBLED_FINAL_CONSONANT = /([bcdfghjkmnpqrtvwxy])\1$/;
const TRAILING_E = /e$/;
const VOWEL = /[aeiouy]/;

const shortenedTo = (request: { readonly stem: string; readonly shortened: string; readonly floor: number }): string =>
  request.shortened.length >= request.floor ? request.shortened : request.stem;

const voicedShortenedTo = (request: { readonly stem: string; readonly shortened: string }): string =>
  VOWEL.test(request.shortened) ? shortenedTo({ ...request, floor: MINIMUM_STEM_LETTERS }) : request.stem;

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
  const bare = voicedShortenedTo({ stem: request.stem, shortened: request.stem.replace(INFLECTION, "") });
  return bare === request.stem ? bare : shortenedTo({ stem: bare, shortened: bare.replace(DOUBLED_FINAL_CONSONANT, "$1"), floor: MINIMUM_LETTERS });
};

const stemOf = (request: { readonly word: string }): string => {
  const stem = uninflectedOf({ stem: singularOf(request) });
  return shortenedTo({ stem, shortened: stem.replace(TRAILING_E, ""), floor: MINIMUM_STEM_LETTERS });
};

type WordReading = "content" | "dropped";

const wordReadingOf = (request: { readonly word: string }): WordReading =>
  request.word.length >= MINIMUM_LETTERS && !FUNCTION_WORDS.has(request.word) && !BARE_NUMBER.test(request.word)
    ? "content"
    : "dropped";

export const stemsOf = (request: { readonly text: string }): Stems => {
  const spellings = request.text
    .replace(NEGATIVE_CONTRACTION, " not")
    .replace(CAMEL_CASE_BOUNDARY, "$1 $2")
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((word) => wordReadingOf({ word }) === "content")
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
