import { readFile } from "node:fs/promises";
import type { ExecFileOptions } from "node:child_process";
import { createHook } from
  "node:async_hooks";
import "node:worker_threads";
export { basename } from "node:path";
import fs = require("node:fs");
const util = require("node:util");
const v8 = import("node:v8");
const h2 = import("node:http2");
const template = require(`node:fs`);
export type Fs = typeof import("node:fs");
export type Stats = import("node:fs").Stats;
export type Options = ExecFileOptions;
const text = "import x from node:crypto";
// import x from "node:crypto";
import fsBare from "fs";
export const probe = { readFile, createHook, fs, util, v8, h2, template, text, fsBare };
