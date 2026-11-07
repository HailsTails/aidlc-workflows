export type Clock = { readonly now: () => number };

export const createSystemClock = (): Clock => ({ now: () => Date.now() });
