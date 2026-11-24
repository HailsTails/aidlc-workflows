import { expect, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { renderConductorPermissions } from "./conductor-permission-template.ts";


const CONDUCTOR_PERMISSION_CASES = [
  {
    "label": "only admitted match values change",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "expected": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"new allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"new ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n"
  },
  {
    "label": "reordered keys and comments retain exact lexemes",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - effect: allow # chosen effect\n      # keep this comment\n      capability: shell\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "expected": "---\nname: conductor\npermissions:\n  rules:\n    - effect: allow # chosen effect\n      # keep this comment\n      capability: shell\n      match:\n        - \"new allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"new ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n"
  },
  {
    "label": "CRLF and unrelated frontmatter, deny and body remain exact",
    "source": "---\r\nname: conductor\r\npermissions:\r\n  rules:\r\n    - capability: shell\r\n      effect: allow\r\n      match:\r\n        - \"old allow\"\r\n    - capability: shell\r\n      effect: ask\r\n      match:\r\n        - \"old ask\"\r\n    - capability: shell\r\n      effect: deny\r\n      match:\r\n        - \"keep deny\"\r\nunrelated: preserve\r\n---\r\nBody: keep every byte\r\n",
    "expected": "---\r\nname: conductor\r\npermissions:\r\n  rules:\r\n    - capability: shell\r\n      effect: allow\r\n      match:\r\n        - \"new allow\"\r\n    - capability: shell\r\n      effect: ask\r\n      match:\r\n        - \"new ask\"\r\n    - capability: shell\r\n      effect: deny\r\n      match:\r\n        - \"keep deny\"\r\nunrelated: preserve\r\n---\r\nBody: keep every byte\r\n"
  },
  {
    "label": "match can precede capability and effect",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - match:\n        - \"old ask\"\n      effect: ask\n      capability: shell\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "expected": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"new allow\"\n    - match:\n        - \"new ask\"\n      effect: ask\n      capability: shell\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n"
  }
];

const CONDUCTOR_PERMISSION_REFUSALS = [
  {
    "label": "body only",
    "source": "Body\n",
    "reason": "requires opening frontmatter"
  },
  {
    "label": "unclosed",
    "source": "---\npermissions:\n",
    "reason": "requires closed frontmatter"
  },
  {
    "label": "misleading delimiter",
    "source": "---\npermissions:\n---tail\n",
    "reason": "requires closed frontmatter"
  },
  {
    "label": "missing permissions",
    "source": "---\nname: conductor\n---\n",
    "reason": "requires exactly one permissions mapping"
  },
  {
    "label": "duplicate permissions",
    "source": "---\npermissions:\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one permissions mapping"
  },
  {
    "label": "quoted duplicate permissions",
    "source": "---\n\"permissions\": {}\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one permissions mapping"
  },
  {
    "label": "missing rules",
    "source": "---\nname: conductor\npermissions:\n  other:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one rules sequence"
  },
  {
    "label": "duplicate rules",
    "source": "---\nname: conductor\npermissions:\n  rules:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one rules sequence"
  },
  {
    "label": "missing ask",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one shell allow and one shell ask rule"
  },
  {
    "label": "duplicate allow",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: allow\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires exactly one shell allow and one shell ask rule"
  },
  {
    "label": "duplicate scalar",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      effect: ask\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one plain capability and effect in each rule"
  },
  {
    "label": "quoted duplicate scalar",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      \"effect\": ask\n      match:\n        - \"old allow\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one plain capability and effect in each rule"
  },
  {
    "label": "flow match",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match: [\"old allow\"]\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one block match list in each managed shell rule"
  },
  {
    "label": "missing match",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one block match list in each managed shell rule"
  },
  {
    "label": "extra managed key",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n      exclude: []\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one block match list in each managed shell rule"
  },
  {
    "label": "noncontiguous list",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n        # ambiguous list comment\n        - \"extra\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires contiguous block entries in managed match lists"
  },
  {
    "label": "quoted duplicate match",
    "source": "---\nname: conductor\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"old allow\"\n      \"match\": [\"stale\"]\n    - capability: shell\n      effect: ask\n      match:\n        - \"old ask\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"keep deny\"\nunrelated: preserve\n---\nBody: keep every byte\n",
    "reason": "requires one block match list in each managed shell rule"
  }
];


const shell = {
  allow: ["    - capability: shell", "      effect: allow", "      match:", '        - "new allow"'],
  ask: ["    - capability: shell", "      effect: ask", "      match:", '        - "new ask"'],
};

test.each(CONDUCTOR_PERMISSION_CASES)("$label", ({ source, expected }) => {
  expect(renderConductorPermissions({ source, shell })).toEqual(accepted(expected));
});

test.each(CONDUCTOR_PERMISSION_REFUSALS)("$label refuses atomically", ({ source, reason }) => {
  expect(renderConductorPermissions({ source, shell })).toEqual(refused({
    kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
    reason: `The conductor permission template ${reason}.`,
  }));
});