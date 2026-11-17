// browser.ts - opens a web address in the user's default browser.

import { spawn } from "node:child_process";

export function openBrowser(url: string): void {
  if (process.env.TYGIG_NO_BROWSER) return;   // tests, or computers without a browser

  // Each system has its own "open this" program. The address is passed as a
  // separate argument (no shell), so characters such as & cannot break it.
  const [command, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] :
    process.platform === "darwin" ? ["open", [url]] :
    ["xdg-open", [url]];

  try {
    const child = spawn(command as string, args as string[], { stdio: "ignore", detached: true });
    child.on("error", () => { /* no browser: the address is also shown on screen */ });
    child.unref();   // do not keep Tygig waiting for the browser
  } catch {
    // same: the user can copy the address from the screen
  }
}
