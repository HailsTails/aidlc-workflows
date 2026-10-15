declare const dec: (value: unknown) => (target: unknown, context: unknown) => void;
@dec(class {}) class A {}
