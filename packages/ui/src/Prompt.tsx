// Prompt.tsx - one line of text input, with a label. `secret` hides what you type.

import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface PromptProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
  focus?: boolean;
}

export function Prompt({ label, value, onChange, onSubmit, placeholder, secret, focus = true }: PromptProps) {
  return (
    <Box>
      <Text color="cyan" bold>{label} </Text>
      {/* A pasted text with line breaks becomes one line: this input is a single line. */}
      <TextInput value={value} onChange={(text) => onChange(text.replace(/\r\n|\r|\n/g, " "))} onSubmit={onSubmit}
                 placeholder={placeholder} mask={secret ? "*" : undefined} focus={focus} />
    </Box>
  );
}
