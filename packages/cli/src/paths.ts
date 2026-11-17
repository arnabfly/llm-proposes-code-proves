// paths.ts - where Tygig keeps its files on your computer, and which folder is
// "the project".
//
//   ~/.tygig/config.json        which provider and model you use
//   ~/.tygig/credentials.json   your keys and sign-in tokens
//   ~/.tygig/projects/...       saved conversations, one folder per project
//
// "~" is your home folder: C:\Users\<you> on Windows, /home/<you> on Linux.
// The TYGIG_HOME environment variable can point somewhere else (used by tests).

import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Paths {
  home: string;
  config: string;
  credentials: string;
}

export function getPaths(): Paths {
  const home = process.env.TYGIG_HOME ?? path.join(os.homedir(), ".tygig");
  return {
    home,
    config: path.join(home, "config.json"),
    credentials: path.join(home, "credentials.json"),
  };
}

/**
 * The folder you started Tygig in. On Windows the same folder can be reported as
 * "c:\proj" or "C:\proj" depending on the terminal; asking Windows for the real
 * spelling makes both the same, so your saved conversations are always found.
 */
export function currentProjectFolder(): string {
  const cwd = process.cwd();
  if (process.platform !== "win32") return cwd;
  try {
    const real = realpathSync.native(cwd);
    return real.charAt(0).toUpperCase() + real.slice(1);
  } catch {
    return cwd;
  }
}
