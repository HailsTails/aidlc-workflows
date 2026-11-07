type Secret = {
  readonly reveal: () => string;
  readonly toJSON: () => string;
  readonly toString: () => string;
  readonly [inspectionKey: symbol]: () => string;
};

const REDACTED = "[redacted]";

const NODE_INSPECTION = Symbol.for("nodejs.util.inspect.custom");

const secret = (sensitiveText: string): Secret => ({
  reveal: () => sensitiveText,
  toJSON: () => REDACTED,
  toString: () => REDACTED,
  [NODE_INSPECTION]: () => REDACTED,
});

export { secret, type Secret };
