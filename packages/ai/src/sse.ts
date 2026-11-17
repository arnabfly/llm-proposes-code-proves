// sse.ts - reads a Server-Sent Events stream.
//
// All three formats stream replies the same way: the HTTP response stays open and
// the server writes small text blocks, separated by a blank line:
//
//   event: content_block_delta          <- optional: the kind of message
//   data: {"type":"...","delta":{...}}  <- the content (usually JSON)
//                                       <- blank line = end of this message
//
// This file turns the raw bytes into one { event, data } object per block.

import { ProviderError } from "@tygig/core";

export interface SseMessage {
  event: string;   // "" when the server sent no "event:" line
  data: string;    // the data text, not yet parsed
}

export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const decoder = new TextDecoder();     // bytes -> text, handling characters split across chunks
  let buffer = "";                       // text received but not yet processed

  try {
    for await (const chunk of body) {    // each chunk is whatever the network delivered
      buffer += decoder.decode(chunk, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");        // some servers end lines with \r\n

      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {  // a complete block is available
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const message = parseBlock(block);
        if (message) yield message;                  // hand it to the translator
      }
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;          // you pressed Esc: not an error
    // The network dropped in the middle of the reply (Node reports only "terminated").
    throw new ProviderError("The connection was interrupted before the reply was complete.", undefined, undefined,
      "Ask again. If it keeps happening, check your network connection.", false);
  }

  const last = parseBlock(buffer);       // a final block without a trailing blank line
  if (last) yield last;
}

function parseBlock(block: string): SseMessage | undefined {
  let event = "";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;                        // a comment (keep-alive)
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length === 0) return undefined;                     // nothing to deliver
  return { event, data: data.join("\n") };
}

/** Parse JSON without throwing. Returns undefined for text that is not valid JSON. */
export function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
