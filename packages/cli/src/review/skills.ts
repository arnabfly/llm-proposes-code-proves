// skills.ts - loads the review skills (Agent Skills format: a folder with a SKILL.md
// that starts with "name" and "description"; design document §12).
//
// There is no skills loader in Tygig yet: the text of each SKILL.md is added to the
// instructions in full (instructions.ts).

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface Skill {
  name: string;
  description: string;
  body: string;        // the instructions after the front matter
}

const SKILLS_DIR = fileURLToPath(new URL("./skills/", import.meta.url));

/** Read every skills/<name>/SKILL.md. */
export function loadSkills(dir = SKILLS_DIR): Skill[] {
  const skills: Skill[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const text = readFileSync(path.join(dir, entry.name, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!m) throw new Error(`${entry.name}/SKILL.md has no front matter (--- name, description ---).`);
    const field = (key: string) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(m[1]!)?.[1]?.trim() ?? "";
    const name = field("name"), description = field("description");
    if (!name || !description) throw new Error(`${entry.name}/SKILL.md needs both "name" and "description".`);
    skills.push({ name, description, body: m[2]!.trim() });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/** All skills as one block of text for the instructions. */
export function skillsText(skills = loadSkills()): string {
  return skills.map((s) => `<skill name="${s.name}">\n${s.description}\n\n${s.body}\n</skill>`).join("\n\n");
}
