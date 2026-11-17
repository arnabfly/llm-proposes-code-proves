// Picker.tsx - choose one item from a list with the arrow keys.
// For long lists (OpenRouter has hundreds of models) you can type to filter.

import { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface PickerItem {
  label: string;     // shown
  value: string;     // returned when chosen
  hint?: string;     // shown dimmed after the label
}

interface PickerProps {
  title: string;
  items: PickerItem[];
  onSelect: (value: string) => void;
  onCancel?: () => void;
  allowCustom?: boolean;   // offer "use what I typed" when it matches nothing
  pageSize?: number;
}

export function Picker({ title, items, onSelect, onCancel, allowCustom = false, pageSize = 10 }: PickerProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(false);   // ignore a second Enter (key repeat)
  const filterable = items.length > pageSize || allowCustom;

  // The visible list: items matching what was typed (+ the typed text itself, if allowed).
  const q = query.toLowerCase();
  const shown = items.filter((item) => item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q));
  if (allowCustom && query !== "" && !items.some((item) => item.value === query)) {
    shown.push({ label: `Use "${query}"`, value: query, hint: "as typed" });
  }
  const current = Math.min(index, Math.max(shown.length - 1, 0));

  useInput((input, key) => {
    if (chosen) return;
    if (key.upArrow) setIndex(Math.max(current - 1, 0));
    else if (key.downArrow) setIndex(Math.min(current + 1, shown.length - 1));
    else if (key.return) { const item = shown[current]; if (item) { setChosen(true); onSelect(item.value); } }
    else if (key.escape) onCancel?.();
    else if (filterable && (key.backspace || key.delete)) { setQuery(query.slice(0, -1)); setIndex(0); }
    else if (filterable && input && !key.ctrl && !key.meta && !key.tab) { setQuery(query + input); setIndex(0); }
  });

  // Show a window of `pageSize` items around the selected one.
  const start = Math.max(0, Math.min(current - Math.floor(pageSize / 2), shown.length - pageSize));
  const visible = shown.slice(start, start + pageSize);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{title}</Text>
      {filterable && <Text dimColor>Filter: <Text color="cyan">{query}</Text>▏</Text>}
      {visible.map((item, i) => {
        const selected = start + i === current;
        return (
          <Text key={item.value + i} color={selected ? "cyan" : undefined}>
            {selected ? "› " : "  "}{item.label}{item.hint ? <Text dimColor>   {item.hint}</Text> : null}
          </Text>
        );
      })}
      {shown.length === 0 && <Text dimColor>  (nothing matches)</Text>}
      {shown.length > pageSize && <Text dimColor>  {shown.length} items</Text>}
      <Text dimColor>↑↓ move · Enter choose{onCancel ? " · Esc back" : ""}{filterable ? " · type to filter" : ""}</Text>
    </Box>
  );
}
