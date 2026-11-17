// LoginApp.tsx - connecting a model: ChatGPT account, API key, or local model.
//
// A small wizard. Each screen is one "step"; choosing something moves to the next.
// Nothing is saved until the connection has been tested (by listing the models).

import { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { PRESETS, getPreset } from "@tygig/ai";
import { markWelcomed, signInWithChatGPT, updateCredentials } from "@tygig/auth";
import { Picker, Prompt, Spinner } from "@tygig/ui";
import { readConfig, writeConfig } from "./config.js";
import { connect, keySlot } from "./connect.js";
import type { Draft } from "./connect.js";
import type { Paths } from "./paths.js";

interface LoginAppProps {
  paths: Paths;
  result: { saved: boolean };   // read by main.tsx afterwards
}

type Step =
  | { name: "method" }
  | { name: "chatgpt" }
  | { name: "welcome" }
  | { name: "api-provider" }
  | { name: "local-provider" }
  | { name: "address"; presetId: string; back: Step; error?: string }
  | { name: "key"; presetId: string; baseUrl?: string; back: Step; error?: string }
  | { name: "checking"; label: string }
  | { name: "model"; draft: Draft; models: string[]; note?: string }
  | { name: "failed"; message: string; hint: string; back: Step }
  | { name: "done"; text: string };

/** What to do when a local server has no models yet. */
const NO_MODELS: Record<string, string> = {
  ollama: "No models found. Download one first, e.g.: ollama pull llama3.2  (then press Esc and try again)",
  lmstudio: "No models found. In LM Studio, download and load a model first (then press Esc and try again).",
};

export function LoginApp({ paths, result }: LoginAppProps) {
  const { exit } = useApp();
  const { write } = useStdout();
  const [step, setStep] = useState<Step>({ name: "method" });
  const [text, setText] = useState("");                 // the address or key being typed
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Leave once the final message has been drawn. If the wizard closes early
  // (Ctrl+C), stop a ChatGPT sign-in that is still waiting for the browser.
  useEffect(() => { if (step.name === "done") exit(); }, [step, exit]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Esc: cancel the ChatGPT sign-in, or go back one step.
  useInput((_input, key) => {
    if (!key.escape) return;
    if (step.name === "chatgpt") abortRef.current?.abort();
    if (step.name === "address" || step.name === "key" || step.name === "failed") { setText(""); setStep(step.back); }
  }, { isActive: ["chatgpt", "address", "key", "failed"].includes(step.name) });

  const fail = (err: any, back: Step) =>
    setStep({ name: "failed", message: err?.message ?? String(err),
              hint: err?.hint ?? "Press Esc to go back and try again.", back });

  // --- Sign in with ChatGPT ------------------------------------------------
  async function startChatGPT() {
    const abort = new AbortController();
    abortRef.current = abort;
    setStep({ name: "chatgpt" });
    try {
      const signIn = await signInWithChatGPT(paths.credentials, (url) => {
        // Printed once, above the wizard, so it can be copied in one piece.
        write(`\nIf your browser did not open, copy this address into it:\n\n${url}\n\n`);
      }, abort.signal);
      if (!signIn.planUsage) {
        fail({ message: "You signed in, but did not allow Tygig to use your ChatGPT plan.",
               hint: "Press Esc, then sign in again and allow it, or choose API key." }, { name: "method" });
      } else if (signIn.firstTime) {
        setStep({ name: "welcome" });           // OpenAI asks apps to show this once
      } else {
        await check({ provider: "chatgpt" }, { name: "method" });
      }
    } catch (err) {
      fail(err, { name: "method" });
    }
  }

  // --- Test the connection by listing the models, then save the key ---------
  async function check(draft: Draft, back: Step) {
    setStep({ name: "checking", label: `Connecting to ${getPreset(draft.provider).label}` });
    try {
      const connected = await connect(draft, paths);
      let models: string[] = [];
      let note: string | undefined;
      try {
        models = await connected.provider.listModels();
        if (models.length === 0) note = NO_MODELS[draft.provider] ?? "The provider listed no models. Type the model name.";
      } catch (err: any) {
        // Some servers cannot list models but can still answer. Anything else is a real failure.
        if (err.status !== 404 && err.status !== 405) throw err;
        note = "This provider does not list its models. Type the model name.";
      }
      const slot = keySlot(draft.provider, draft.baseUrl);
      if (draft.apiKey) {                       // a typed key works: keep it
        await updateCredentials(paths.credentials, (c) => { c.apiKeys[slot] = draft.apiKey!; });
      } else if (draft.keySource === "env") {   // use the environment from now on: forget an old stored key
        await updateCredentials(paths.credentials, (c) => { delete c.apiKeys[slot]; });
      }
      setStep({ name: "model", draft: { ...draft, apiKey: undefined, keySource: undefined }, models, note });
    } catch (err) {
      fail(err, back);
    }
  }

  async function saveModel(draft: Draft, model: string) {
    try {
      // Keep settings you may have added by hand (maxTokens, stepLimit) when the provider stays the same.
      const old = await readConfig(paths.config);
      const kept = old && old.provider === draft.provider ? old : {};
      const config = { ...kept, provider: draft.provider, model, baseUrl: draft.baseUrl };
      if (!config.baseUrl) delete config.baseUrl;
      await writeConfig(paths.config, config);
      result.saved = true;
      setStep({ name: "done", text: `Connected: ${getPreset(draft.provider).label} · ${model}` });
    } catch (err) {
      fail(err, { name: "method" });
    }
  }

  // --- The screens --------------------------------------------------------
  switch (step.name) {
    case "method":
      return (
        <Picker key="method" title="How do you want to connect a model?"
          items={[
            { label: "Continue with ChatGPT", value: "chatgpt", hint: "use your ChatGPT plan (Go, Plus, Pro)" },
            { label: "API key", value: "api", hint: "OpenAI, Anthropic, OpenRouter, Gemini and more" },
            { label: "Local model", value: "local", hint: "Ollama or LM Studio on this computer" },
          ]}
          onSelect={(v) => {
            if (v === "chatgpt") void startChatGPT();
            else setStep(v === "api" ? { name: "api-provider" } : { name: "local-provider" });
          }}
          onCancel={() => exit()} />
      );

    case "chatgpt":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Spinner label="Waiting for you to sign in to ChatGPT in your browser…" />
          <Text dimColor>Esc cancels.</Text>
        </Box>
      );

    case "welcome":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">You’re using your ChatGPT plan</Text>
          <Text>Requests from Tygig count towards your ChatGPT plan’s usage.</Text>
          <Text dimColor>Manage usage: ChatGPT &gt; Settings &gt; Usage (you can set a weekly limit for Tygig).</Text>
          <Picker key="welcome" title="" items={[{ label: "Got it", value: "ok" }]}
            onSelect={() => {
              markWelcomed(paths.credentials)
                .then(() => check({ provider: "chatgpt" }, { name: "method" }))
                .catch((err) => fail(err, { name: "method" }));
            }} />
        </Box>
      );

    case "api-provider":
      return (
        <Picker key="api-provider" title="Which provider is your API key for?"
          items={PRESETS.filter((p) => p.kind === "api").map((p) => ({
            label: p.label, value: p.id,
            hint: p.keyEnv && process.env[p.keyEnv] ? `key found in ${p.keyEnv}` : undefined,
          }))}
          onSelect={(id) => {
            setText("");
            const back: Step = { name: "api-provider" };
            setStep(getPreset(id).baseUrl ? { name: "key", presetId: id, back } : { name: "address", presetId: id, back });
          }}
          onCancel={() => setStep({ name: "method" })} />
      );

    case "local-provider":
      return (
        <Picker key="local-provider" title="Which program runs your model?"
          items={PRESETS.filter((p) => p.kind === "local").map((p) => ({
            label: p.label, value: p.id, hint: p.baseUrl || "you type the address",
          }))}
          onSelect={(id) => {
            setText("");
            const back: Step = { name: "local-provider" };
            if (getPreset(id).baseUrl) void check({ provider: id }, back);
            else setStep({ name: "address", presetId: id, back });
          }}
          onCancel={() => setStep({ name: "method" })} />
      );

    case "address":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>The server’s address: the part before “/chat/completions”, usually ending in /v1.</Text>
          <Text dimColor>Example: https://api.example.com/v1   ·   Esc goes back</Text>
          {step.error && <Text color="red">{step.error}</Text>}
          <Prompt label="Address:" value={text} onChange={setText}
            onSubmit={(value) => {
              // Accept a full endpoint address too: remove the endpoint part and any final "/".
              const address = value.trim().replace(/\/(chat\/completions|responses|messages|models)\/?$/, "").replace(/\/+$/, "");
              if (!/^https?:\/\/[^\s/]+/.test(address)) {
                setStep({ ...step, error: "That is not an address. It must start with http:// or https://" });
                return;
              }
              setText("");
              const id = step.presetId;
              if (getPreset(id).kind === "local") void check({ provider: id, baseUrl: address }, step);
              else setStep({ name: "key", presetId: id, baseUrl: address, back: step });
            }} />
        </Box>
      );

    case "key": {
      const preset = getPreset(step.presetId);
      const envKey = preset.keyEnv ? process.env[preset.keyEnv] : undefined;
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>Paste your {preset.label} API key and press Enter.</Text>
          {preset.keyUrl && <Text dimColor>Get one at: {preset.keyUrl}</Text>}
          {envKey && <Text dimColor>Or press Enter with nothing typed to use the key in {preset.keyEnv}.</Text>}
          {preset.id === "custom" && <Text dimColor>If this server needs no key, press Enter with nothing typed.</Text>}
          <Text dimColor>The key is stored only on this computer, in {paths.credentials}   ·   Esc goes back</Text>
          {step.error && <Text color="red">{step.error}</Text>}
          <Prompt label="Key:" value={text} onChange={setText} secret
            onSubmit={(value) => {
              const key = value.trim();
              if (!key && !envKey && preset.id !== "custom") {
                setStep({ ...step, error: "A key is needed." });
                return;
              }
              setText("");
              const draft: Draft = key ? { provider: preset.id, baseUrl: step.baseUrl, apiKey: key }
                                 : envKey ? { provider: preset.id, baseUrl: step.baseUrl, keySource: "env" }
                                 : { provider: preset.id, baseUrl: step.baseUrl };
              void check(draft, step);
            }} />
        </Box>
      );
    }

    case "checking":
      return <Box marginTop={1}><Spinner label={step.label} /></Box>;

    case "model":
      return (
        <Box flexDirection="column">
          {step.note && <Text color="yellow">{step.note}</Text>}
          <Picker key="model" title="Choose a model (type to filter)" allowCustom
            items={step.models.map((m) => ({ label: m, value: m }))}
            onSelect={(m) => void saveModel(step.draft, m)}
            onCancel={() => setStep({ name: "method" })} />
        </Box>
      );

    case "failed":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">✗ {step.message}</Text>
          <Text dimColor>  {step.hint}</Text>
          <Text dimColor>  Esc goes back · Ctrl+C quits</Text>
        </Box>
      );

    case "done":
      return <Box marginTop={1}><Text color="green">✓ {step.text}</Text></Box>;
  }
}
