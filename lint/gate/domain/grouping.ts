const REGEX_SPECIALS = ".*+?^${}()|[]\\";
const ESCAPE = String.fromCharCode(92);

export const escapeRegex = (text: string): string =>
  Array.from(text, (character) =>
    REGEX_SPECIALS.includes(character) ? ESCAPE + character : character,
  ).join("");

export const assignGroups = <T extends { readonly weight: number }>(
  items: readonly T[],
  groups: number,
): readonly (readonly T[])[] => {
  const buckets = Array.from({ length: Math.max(1, groups) }, () => ({
    total: 0,
    members: [] as T[],
  }));
  for (const item of [...items].sort((a, b) => b.weight - a.weight)) {
    const lightest = buckets.reduce((best, next) => (next.total < best.total ? next : best));
    lightest.members.push(item);
    lightest.total += item.weight;
  }
  return buckets.filter((bucket) => bucket.members.length > 0).map((bucket) => bucket.members);
};
