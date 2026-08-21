#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

function resolveExistingPath(candidate) {
  if (!candidate) return '';
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? resolved : '';
}

function lookupCommand(command) {
  const binary = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(binary, [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && existsSync(line)) || '';
  } catch {
    return '';
  }
}

function playwrightChromiumPath() {
  for (const packageName of ['playwright', 'playwright-core']) {
    try {
      return resolveExistingPath(require(packageName).chromium.executablePath());
    } catch {
      continue;
    }
  }
  return '';
}

function macChromeCandidates() {
  if (process.platform !== 'darwin') return [];
  return [
    path.join(path.sep, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    path.join(path.sep, 'Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    path.join(path.sep, 'Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
  ];
}

export function resolveChromeExecutablePath() {
  if (process.env.CHROME_PATH) {
    return resolveExistingPath(process.env.CHROME_PATH);
  }

  const resolvedByPlaywright = playwrightChromiumPath();
  if (resolvedByPlaywright) return resolvedByPlaywright;

  const commands = process.platform === 'win32'
    ? ['chrome.exe', 'chromium.exe', 'msedge.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge'];

  for (const command of commands) {
    const resolved = lookupCommand(command);
    if (resolved) return resolved;
  }

  for (const candidate of macChromeCandidates()) {
    const resolved = resolveExistingPath(candidate);
    if (resolved) return resolved;
  }

  return '';
}

export function getChromeExecutablePath() {
  const resolved = resolveChromeExecutablePath();
  if (resolved) return resolved;
  throw new Error(
    'Chrome executable not found. Set CHROME_PATH to a local Chrome/Chromium executable and rerun the validation.',
  );
}
