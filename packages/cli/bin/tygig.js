#!/usr/bin/env node
// tygig.js - the file that runs when you type `tygig`.
//
// Tygig is written in TypeScript. Node.js runs JavaScript, so this small file
// first switches on `tsx`, which translates TypeScript on the fly, and then
// starts the real program in src/main.tsx.
//
// tsx needs Tygig's tsconfig.json (it says how to translate the screen code).
// You start Tygig from your own project folder, where that file is not, so we
// point tsx at it explicitly: three folders up from this file.

import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(`Tygig needs Node.js 22 or newer. You have ${process.versions.node}. Install it from https://nodejs.org`);
  process.exit(1);
}

register({ tsconfig: fileURLToPath(new URL("../../../tsconfig.json", import.meta.url)) });
await import("../src/main.tsx");
