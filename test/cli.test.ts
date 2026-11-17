// cli.test.ts - joining settings, credentials and translators (connect.ts).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { updateCredentials } from "@tygig/auth";
import { connect, keySlot } from "../packages/cli/src/connect.ts";
import type { Paths } from "../packages/cli/src/paths.ts";

async function tempPaths(): Promise<Paths> {
  const home = await mkdtemp(path.join(os.tmpdir(), "tygig-"));
  return { home, config: path.join(home, "config.json"), credentials: path.join(home, "credentials.json") };
}

describe("connect", () => {
  test("each custom server has its own key slot: a key is never sent to another server", async () => {
    const paths = await tempPaths();
    await updateCredentials(paths.credentials, (c) => { c.apiKeys[keySlot("custom", "https://a.example/v1")] = "key-for-a"; });
    const a = await connect({ provider: "custom", model: "m", baseUrl: "https://a.example/v1" }, paths);
    const b = await connect({ provider: "custom", model: "m", baseUrl: "https://b.example/v1" }, paths);
    assert.deepEqual(a.secrets, ["key-for-a"]);
    assert.deepEqual(b.secrets, []);
  });

  test("TYGIG_BASE_URL is ignored unless TYGIG_HOME is also set", async () => {
    const paths = await tempPaths();
    const saved = { home: process.env.TYGIG_HOME, base: process.env.TYGIG_BASE_URL };
    try {
      delete process.env.TYGIG_HOME;
      process.env.TYGIG_BASE_URL = "http://evil.example/v1";
      const c = await connect({ provider: "ollama", model: "m" }, paths);
      assert.equal(c.label, "Ollama");
      // The override is not used: listModels would go to 127.0.0.1:11434, not evil.example.
      await assert.rejects(c.provider.listModels(), (err: Error) => !err.message.includes("evil.example"));
    } finally {
      if (saved.home !== undefined) process.env.TYGIG_HOME = saved.home; else delete process.env.TYGIG_HOME;
      if (saved.base !== undefined) process.env.TYGIG_BASE_URL = saved.base; else delete process.env.TYGIG_BASE_URL;
    }
  });

  test("a typed key wins over a stored key and the environment", async () => {
    const paths = await tempPaths();
    await updateCredentials(paths.credentials, (c) => { c.apiKeys.openai = "stored"; });
    process.env.OPENAI_API_KEY = "from-env";
    try {
      assert.deepEqual((await connect({ provider: "openai", apiKey: "typed" }, paths)).secrets, ["typed"]);
      assert.deepEqual((await connect({ provider: "openai", keySource: "env" }, paths)).secrets, ["from-env"]);
      assert.deepEqual((await connect({ provider: "openai", model: "m" }, paths)).secrets, ["stored"]);
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  test("an API-key provider without any key asks you to log in", async () => {
    const paths = await tempPaths();
    await assert.rejects(connect({ provider: "anthropic", model: "m" }, paths), /tygig login/);
  });
});
