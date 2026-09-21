#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.argv[2] || 'AI_AGENT_PROJECT_BUNDLE.md');
const EXCLUDED = [
  /^\.git(?:\/|$)/u,
  /^node_modules(?:\/|$)/u,
  /^dist(?:\/|$)/u,
  /^coverage(?:\/|$)/u,
  /^\.cache(?:\/|$)/u,
  /^\.vite(?:\/|$)/u,
  /(^|\/)(\.env|\.env\.|.*\.pem$|.*\.key$)/u,
  /^AI_AGENT_PROJECT_BUNDLE\.md$/u,
];
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.mdx', '.css', '.scss', '.html',
  '.yml', '.yaml', '.toml', '.xml', '.svg', '.txt', '.sql', '.sh', '.py', '.rs', '.go',
]);
const isExcluded = (file) => EXCLUDED.some((pattern) => pattern.test(file));
const isText = (file) => TEXT_EXT.has(path.extname(file).toLowerCase()) || path.basename(file).startsWith('.');

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(Boolean).filter((file) => !isExcluded(file) && isText(file));

const prompt = fs.readFileSync(path.resolve(ROOT, 'المهام.md'), 'utf8');
const sections = [];
sections.push('# FLIXO-AI-TOOLS — FULL AI AGENT PROJECT BUNDLE');
sections.push(`\n> Generated from exact Git SHA: \`${sha}\``);
sections.push(`> Files included: **${files.length}**`);
sections.push('\n## MASTER PROMPT\n\n' + prompt);
sections.push('\n## REPOSITORY MANIFEST\n\n```text\n' + files.join('\n') + '\n```');

for (const file of files) {
  const absolute = path.resolve(ROOT, file);
  let content;
  try {
    content = fs.readFileSync(absolute, 'utf8');
  } catch {
    continue;
  }
  if (/\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*[=:])/u.test(content)) {
    sections.push(`\n## FILE: ${file}\n\n> Omitted because secret-like material was detected. Inspect the file locally with credentials redacted.\n`);
    continue;
  }
  const fence = content.includes('```') ? '````' : '```';
  sections.push(`\n## FILE: ${file}\n\n${fence}${path.extname(file).slice(1) || 'text'}\n${content}\n${fence}\n`);
}

fs.writeFileSync(OUT, sections.join('\n'), 'utf8');
console.log(JSON.stringify({ output: OUT, sha, files: files.length, status: 'GENERATED' }, null, 2));
