// covers: file:core/tools/aidlc-managed-file-reconciliation.ts
import { expect, test } from "bun:test";
import { reconcileShippedFile, reconcileRetiredFile, type ShippedFileRequest, type ShippedFileDecision, type RetiredFileRequest, type RetiredFileDecision } from "./aidlc-managed-file-reconciliation.ts";

const shippedCases: { name: string; request: ShippedFileRequest; expected: ShippedFileDecision }[] = [
  {
    "name": "absent creates",
    "request": {
      "target": {
        "kind": "absent"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "create",
      "reason": "target-absent"
    }
  },
  {
    "name": "force does not turn absence into update",
    "request": {
      "target": {
        "kind": "absent"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "create",
      "reason": "target-absent"
    }
  },
  {
    "name": "equal content preserves without prior ownership",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "equal",
        "ownership": "unowned-or-modified",
        "adoption": "none"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "preserve",
      "reason": "content-matches"
    }
  },
  {
    "name": "equal content preserves even unproven",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "equal",
        "ownership": "unproven",
        "adoption": "none"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "preserve",
      "reason": "content-matches"
    }
  },
  {
    "name": "force does not replace equal content",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "equal",
        "ownership": "unproven",
        "adoption": "none"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "preserve",
      "reason": "content-matches"
    }
  },
  {
    "name": "unchanged owned content updates",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unchanged-owned",
        "adoption": "none"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "update",
      "reason": "unchanged-owned"
    }
  },
  {
    "name": "modified or unowned refuses",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unowned-or-modified",
        "adoption": "none"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "unowned-or-modified"
    }
  },
  {
    "name": "nonregular refuses",
    "request": {
      "target": {
        "kind": "non-regular"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "non-regular-target"
    }
  },
  {
    "name": "unproven refuses",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unproven",
        "adoption": "none"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "unproven-ownership"
    }
  },
  {
    "name": "exact source evidence adopts",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unowned-or-modified",
        "adoption": "exact-source-projection"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "update",
      "reason": "adopted-exact-source"
    }
  },
  {
    "name": "legacy signature evidence adopts",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unowned-or-modified",
        "adoption": "legacy-signature"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "update",
      "reason": "adopted-legacy-signature"
    }
  },
  {
    "name": "unproven blocks otherwise adoptable source",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unproven",
        "adoption": "exact-source-projection"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "unproven-ownership"
    }
  },
  {
    "name": "unproven blocks otherwise adoptable legacy",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unproven",
        "adoption": "legacy-signature"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "unproven-ownership"
    }
  },
  {
    "name": "force replaces changed content",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unowned-or-modified",
        "adoption": "none"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "update",
      "reason": "forced-replacement"
    }
  },
  {
    "name": "force replaces nonregular target",
    "request": {
      "target": {
        "kind": "non-regular"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "update",
      "reason": "forced-replacement"
    }
  },
  {
    "name": "force replaces unproven content",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unproven",
        "adoption": "none"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "update",
      "reason": "forced-replacement"
    }
  },
  {
    "name": "forced adoption preserves legacy reason",
    "request": {
      "target": {
        "kind": "regular",
        "proposedContent": "different",
        "ownership": "unproven",
        "adoption": "legacy-signature"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "update",
      "reason": "adopted-legacy-signature"
    }
  }
];

test.each(shippedCases)("$name", ({ request, expected }) => {
  expect(reconcileShippedFile(request)).toEqual(expected);
});

const retiredCases: { name: string; request: RetiredFileRequest; expected: RetiredFileDecision }[] = [
  {
    "name": "absent retirement has no action",
    "request": {
      "target": {
        "kind": "absent"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "none",
      "reason": "target-absent"
    }
  },
  {
    "name": "force leaves absent retirement alone",
    "request": {
      "target": {
        "kind": "absent"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "none",
      "reason": "target-absent"
    }
  },
  {
    "name": "unchanged owned retires",
    "request": {
      "target": {
        "kind": "regular",
        "ownership": "unchanged-owned"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "remove",
      "reason": "no-longer-shipped"
    }
  },
  {
    "name": "modified retirement refuses",
    "request": {
      "target": {
        "kind": "regular",
        "ownership": "locally-modified"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "removed-upstream-but-locally-modified"
    }
  },
  {
    "name": "nonregular retirement refuses",
    "request": {
      "target": {
        "kind": "non-regular"
      },
      "replacement": "preserve-user-changes"
    },
    "expected": {
      "action": "conflict",
      "reason": "removed-upstream-but-locally-modified"
    }
  },
  {
    "name": "force removes modified retirement",
    "request": {
      "target": {
        "kind": "regular",
        "ownership": "locally-modified"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "remove",
      "reason": "no-longer-shipped"
    }
  },
  {
    "name": "force removes nonregular retirement",
    "request": {
      "target": {
        "kind": "non-regular"
      },
      "replacement": "force"
    },
    "expected": {
      "action": "remove",
      "reason": "no-longer-shipped"
    }
  }
];

test.each(retiredCases)("$name", ({ request, expected }) => {
  expect(reconcileRetiredFile(request)).toEqual(expected);
});
