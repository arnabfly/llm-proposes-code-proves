// throttle.ts - a speed brake for benchmark runs: keeps the tokens sent per minute under the
// provider's limit (e.g. OpenAI's tokens-per-minute, TPM), and when the provider still answers
// "rate limit", waits and sends the same request again instead of ending the run.
//
// It wraps the provider; the agent, the tools and the checks are unchanged. Only the timing of
// requests changes, never their content, so the results are the same as without it.

import type { ModelProvider, ModelRequest, StreamEvent } from "@tygig/core";

export interface ThrottleOptions {
  tpm: number;                                   // token budget per rolling 60 seconds
  maxTries?: number;                             // tries per request when rate-limited (default 8)
  now?: () => number;                            // for tests
  sleep?: (ms: number) => Promise<void>;         // for tests
  log?: (line: string) => void;
}

/** A rough token count of a request (about 3.5 characters per token for English, JSON and LaTeX). */
export function estimateTokens(req: ModelRequest): number {
  return Math.ceil(JSON.stringify({ i: req.instructions, m: req.messages, t: req.tools }).length / 3.5);
}

/** True for a rate-limit answer (HTTP 429 or the words "rate limit"). */
export function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 429 || /rate limit/i.test(String(e?.message ?? ""));
}

/** The wait the provider asks for ("Please try again in 4.386s" / "in 120ms"), in ms. */
export function suggestedWait(err: unknown): number | undefined {
  const m = /try again in ([0-9.]+)\s*(ms|s)\b/i.exec(String((err as Error)?.message ?? ""));
  if (!m) return undefined;
  return Math.ceil(Number(m[1]) * (m[2]!.toLowerCase() === "ms" ? 1 : 1000));
}

export function throttled(inner: ModelProvider, opts: ThrottleOptions): ModelProvider {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxTries = opts.maxTries ?? 8;
  const window: { t: number; n: number }[] = [];         // tokens sent in the last 60 s
  const prune = () => { while (window.length > 0 && now() - window[0]!.t >= 60_000) window.shift(); };
  const used = () => window.reduce((a, x) => a + x.n, 0);

  async function waitForRoom(tokens: number): Promise<void> {
    prune();
    while (window.length > 0 && used() + tokens > opts.tpm) {
      await sleep(Math.max(50, window[0]!.t + 60_000 - now() + 50));
      prune();
    }
  }

  return {
    label: inner.label,
    listModels: () => inner.listModels(),
    async *stream(req: ModelRequest): AsyncIterable<StreamEvent> {
      for (let attempt = 1; ; attempt++) {
        const estimate = estimateTokens(req);
        await waitForRoom(estimate);
        const sent = { t: now(), n: estimate };
        window.push(sent);
        let started = false;
        try {
          for await (const ev of inner.stream(req)) {
            started = true;
            if (ev.type === "done" && ev.usage) sent.n = ev.usage.inputTokens + ev.usage.outputTokens;
            yield ev;
          }
          return;
        } catch (err) {
          // Only a request that got no answer at all can be sent again unchanged.
          if (started || !isRateLimit(err) || attempt >= maxTries) throw err;
          const wait = Math.max(suggestedWait(err) ?? 0, 5_000 * attempt);
          opts.log?.(`rate limit: waiting ${(wait / 1000).toFixed(1)} s, then trying the same request again (try ${attempt + 1} of ${maxTries})`);
          await sleep(wait);
        }
      }
    },
  };
}
