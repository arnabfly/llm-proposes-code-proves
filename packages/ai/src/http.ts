// http.ts - sending requests, retrying when it makes sense, and turning failures
// into plain-language errors with a hint (design document D18: say how to fix it).

import { ProviderError } from "@tygig/core";
import type { Connection } from "./connection.js";
import { parseJson } from "./sse.js";

const MAX_ATTEMPTS = 3;   // first try + 2 retries

/**
 * POST a JSON body and return the open response, ready to be read as a stream.
 * Retries rate limits (429) and server errors (5xx, 529); fails fast on everything else.
 * On a 401, a sign-in may renew its token once (conn.onUnauthorized) before giving up.
 */
export async function postJson(conn: Connection, url: string, body: object,
                               signal?: AbortSignal, extraHeaders: Record<string, string> = {}): Promise<Response> {
  let renewed = false;
  for (let attempt = 1; ; attempt++) {
    // Outside the try: a sign-in problem here is not a network problem, so it keeps its own message.
    const auth = await conn.authHeaders();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth, ...extraHeaders },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw networkError(err, url);                 // never reached the server
    }

    if (response.ok) return response;               // 200-299: the stream can begin

    if (response.status === 401 && conn.onUnauthorized && !renewed) {
      renewed = true;                               // only once
      await response.body?.cancel();
      if (await conn.onUnauthorized()) continue;    // new token: try again
    }

    const error = await toProviderError(response, conn.label);
    if (!error.retryable || attempt >= MAX_ATTEMPTS) throw error;
    await sleep(retryDelay(response, attempt), signal);   // wait, then loop again
  }
}

/** GET a JSON document (used for model lists). Gives up after 20 seconds. */
export async function getJson(conn: Connection, url: string,
                              extraHeaders: Record<string, string> = {}): Promise<any> {
  const auth = await conn.authHeaders();          // outside the try, as in postJson
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...auth, ...extraHeaders },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw networkError(err, url);
  }
  if (!response.ok) throw await toProviderError(response, conn.label);
  const json = parseJson(await response.text());
  if (json === undefined) {
    throw new ProviderError(`${conn.label}: the server did not answer with JSON.`, response.status, undefined,
      "Check the address. It usually ends in /v1 (the part before /models and /chat/completions).", false);
  }
  return json;
}

/** How long to wait before the next attempt: the server's Retry-After (at most 30 s), or 1 s, then 2 s. */
function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 30) * 1000;
  return 1000 * 2 ** (attempt - 1);
}

/** Wait, but stop at once if the user presses Esc. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** Turn an HTTP error response into a ProviderError with a useful hint. */
export async function toProviderError(response: Response, label: string): Promise<ProviderError> {
  const text = await response.text().catch(() => "");
  const json = parseJson(text) ?? {};
  // The providers use different shapes; take whichever is present.
  const found = json.error?.message ?? json.detail ?? json.message ??
                (typeof json.error === "string" ? json.error : "");
  const message = typeof found === "string" ? found : JSON.stringify(found);
  const code: string | undefined = json.error?.code ?? json.error?.type ?? json.code ?? undefined;
  return describeError(response.status, code, message || response.statusText, label);
}

/** Errors that arrive inside a stream (after a 200) use the same descriptions. */
export function describeError(status: number | undefined, code: string | undefined,
                              message: string, label: string): ProviderError {
  const say = (hint: string, retryable = false) =>
    new ProviderError(`${label}: ${message}`, status, code, hint, retryable);

  // ChatGPT plan codes (Sign in with ChatGPT documentation, "Errors and recovery").
  switch (code) {
    case "subscription_sharing_usage_limit_exceeded":
      return say("Your ChatGPT plan's limit for Tygig is reached. Manage usage: ChatGPT > Settings > Usage.");
    case "subscription_sharing_user_not_eligible":
      return say("Your ChatGPT plan cannot be used in Tygig. Connect with an API key instead: tygig login");
    case "subscription_sharing_usage_unavailable":
    case "subscription_sharing_user_unavailable":
      return say("ChatGPT could not check your usage just now. Try again in a minute.", true);
    case "subscription_sharing_unsupported_capability":
      return say("This request uses something the ChatGPT plan does not support. Try another model with /model.");
    case "insufficient_quota":
      return say("Your account has no credit left. Add billing on the provider's website.");
    case "overloaded_error":
      return say("The service is overloaded. Try again in a moment.", true);
  }

  if (status === 401) return say("The key or sign-in was rejected. Connect again: tygig login");
  if (status === 403) return say("Access denied. Your account may not have access to this model or region.");
  if (status === 404) return say("Model or address not found. Pick another model with /model, or check the address.");
  if (status === 408 || status === 409) return say("The request timed out. Trying again.", true);
  if (status === 429) return say("Rate limit reached. Waiting and trying again.", true);
  if (status !== undefined && status >= 500) return say("The provider is having problems. Try again in a moment.", true);
  if (status === 400 && /max_tokens/i.test(message))
    return say("The reply length limit is too high for this model. Lower \"maxTokens\" in ~/.tygig/config.json, e.g. to 4096.");
  if (status === 400) return say("The provider rejected the request. The message above says why.");
  return say("Unexpected error. The message above may say more.");
}

/** fetch() itself failed: the request never got an HTTP answer. */
export function networkError(err: unknown, url: string): unknown {
  if (err instanceof Error && err.name === "AbortError") return err;   // the user pressed Esc
  const host = new URL(url).host;
  if (err instanceof Error && err.name === "TimeoutError") {
    return new ProviderError(`Could not reach ${host}: no answer within 20 seconds.`, undefined, "timeout",
      `${host} is not answering. Check the address and that the server is running.`, false);
  }
  const cause: any = (err as any)?.cause;
  const code: string = cause?.code ?? "";
  const detail: string = cause?.message ?? (err as Error)?.message ?? String(err);

  let hint = `Check your internet connection and the address (${host}).`;
  if (code === "ECONNREFUSED")
    hint = `Nothing is answering at ${host}. For a local model: is Ollama or LM Studio running?`;
  else if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    hint = `The address ${host} could not be found. Check your internet connection and the spelling.`;
  else if (/CERT|SSL|TLS/i.test(code + detail))
    hint = `The secure connection to ${host} failed. A network, proxy or firewall may be blocking it. Try another network.`;
  else if (/TIMEOUT/i.test(code))
    hint = `${host} took too long to answer. Try again.`;

  return new ProviderError(`Could not reach ${host}: ${detail}`, undefined, code || undefined, hint, false);
}
