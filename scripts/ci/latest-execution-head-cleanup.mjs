#!/usr/bin/env node

const repository = (process.env.GITHUB_REPOSITORY ?? '').trim();
const token = (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
const branch = 'execution';
import fs from 'node:fs/promises';

const graceDays = Number.parseInt(process.env.FLIXO_STALE_EXECUTION_GRACE_DAYS ?? '14', 10);

if (!/^[^/]+\/[^/]+$/.test(repository) || !token) {
  console.error('FAIL CLOSED: repository/token identity missing for latest-execution cleanup.');
  process.exit(1);
}
if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 365) {
  console.error('FAIL CLOSED: invalid FLIXO_STALE_EXECUTION_GRACE_DAYS.');
  process.exit(1);
}

const apiBase = 'https://api.github.com';
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
  'user-agent': 'FLIXO-latest-execution-head-cleanup',
  'content-type': 'application/json',
};

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {...headers, ...(options.headers ?? {})},
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (parseError) { void parseError; }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${path}: ${text.slice(0, 500)}`);
  }
  return body;
}

async function listAll(path, key) {
  const rows = [];
  for (let page = 1; page <= 100; page += 1) {
    const body = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const pageRows = Array.isArray(body?.[key]) ? body[key] : [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return rows;