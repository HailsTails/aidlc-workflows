type LabelChange = { readonly add: readonly string[]; readonly remove: readonly string[] };

const changesLabels = ({ add, remove }: LabelChange): boolean => add.length + remove.length > 0;

export { changesLabels, type LabelChange };
