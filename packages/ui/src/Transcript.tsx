// Transcript.tsx - the conversation so far, printed once and never redrawn.
//
// Ink redraws the bottom of the screen many times a second while an answer
// streams in. Finished entries go into <Static>: Ink prints each one once and
// leaves it alone, so a long conversation stays fast and does not flicker.

import { Box, Static, Text } from "ink";

/** One finished line (or block) on screen. */
export type Entry =
  | { kind: "header"; provider: string; model: string; folder: string; chatgptPlan: boolean }
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "error"; message: string; hint: string }
  | { kind: "info"; text: string }
  | { kind: "stats"; text: string };

export function Transcript({ entries }: { entries: Entry[] }) {
  return (
    <Static items={entries}>
      {(entry, index) => <EntryView key={index} entry={entry} />}
    </Static>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "header":
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="magenta">tygig</Text>
            <Text dimColor>  ·  {entry.provider}  ·  {entry.model}</Text>
          </Text>
          <Text dimColor>{entry.folder}</Text>
          {entry.chatgptPlan && (
            <Text color="green">Using ChatGPT plan  <Text dimColor>· Manage usage: ChatGPT &gt; Settings &gt; Usage</Text></Text>
          )}
          <Text dimColor>Type a message and press Enter.  /help for commands  ·  Esc interrupts  ·  Ctrl+C quits</Text>
        </Box>
      );
    case "user":
      return (
        <Box marginTop={1}>
          <Text color="cyan" bold>› </Text>
          <Text color="cyan">{entry.text}</Text>
        </Box>
      );
    case "assistant":
      return <Text>{entry.text}</Text>;
    case "error":
      return (
        <Box flexDirection="column">
          <Text color="red">✗ {entry.message}</Text>
          <Text dimColor>  {entry.hint}</Text>
        </Box>
      );
    case "info":
      return <Text dimColor>{entry.text}</Text>;
    case "stats":
      return <Text dimColor>  {entry.text}</Text>;
  }
}
