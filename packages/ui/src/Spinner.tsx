// Spinner.tsx - a small moving sign that shows Tygig is waiting for the model.

import { useEffect, useState } from "react";
import { Text } from "ink";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(timer);       // stop when the spinner disappears
  }, []);
  return <Text color="magenta">{FRAMES[frame]} <Text dimColor>{label}</Text></Text>;
}
