export const parsed = (text: string) => JSON.parse(text) as any;

export const sum = (values: readonly number[]) => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};
