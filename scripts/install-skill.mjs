#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const skillsRoot = join(repoRoot, 'skills');

function parseArgs(argv) {
  const args = { skill: '', agent: '', target: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--skill') args.skill = argv[i + 1] || '';
    if (token === '--agent') args.agent = argv[i + 1] || '';
    if (token === '--target') args.target = argv[i + 1] || '';
  }

  return args;
}

function getPresetTarget(agent) {
  const map = {
    claude: join(homedir(), '.claude', 'skills'),
    codex: join(homedir(), '.codex', 'skills'),
    cursor: join(homedir(), '.cursor', 'skills'),
    continue: join(homedir(), '.continue', 'skills')
  };
  return map[agent] || '';
}

function listAvailableSkills() {
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function usage(message = '') {
  if (message) console.error(`Error: ${message}`);
  console.error('Usage:');
  console.error('  node scripts/install-skill.mjs --skill <name> --agent <claude|codex|cursor|continue>');
  console.error('  node scripts/install-skill.mjs --skill <name> --target <absolute-path>');
  const skills = listAvailableSkills();
  if (skills.length > 0) {
    console.error('Available skills:');
    for (const s of skills) console.error(`  - ${s}`);
  }
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.skill) usage('Missing --skill');

  const source = join(skillsRoot, args.skill);
  if (!existsSync(source)) usage(`Skill not found: ${args.skill}`);

  const targetRoot = args.target || getPresetTarget(args.agent);
  if (!targetRoot) usage('Provide --agent preset or --target path');

  mkdirSync(targetRoot, { recursive: true });
  const destination = join(targetRoot, args.skill);

  cpSync(source, destination, { recursive: true, force: true });
  console.log(`Installed skill ${args.skill} to ${destination}`);
}

main();
