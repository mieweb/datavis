#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_LOCALE = path.join(ROOT, 'src', 'i18n', 'en-US.tsv');
const UPDATE_MODE = process.argv.includes('--update');
const SEARCH_DIRS = [
  path.join(ROOT, 'src'),
];
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const KEY_PATTERN = /^[A-Z0-9_.-]+$/;

function walkFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!VALID_EXTENSIONS.has(ext)) continue;
    files.push(fullPath);
  }
  return files;
}

function readDefinedKeys(tsvFile) {
  const content = fs.readFileSync(tsvFile, 'utf8');
  const keys = new Set();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const [key] = rawLine.split('\t');
    if (key && KEY_PATTERN.test(key.trim())) {
      keys.add(key.trim());
    }
  }

  return keys;
}

function scriptKindFromPath(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

/**
 * Extract the key and optional fallback from a t('KEY') || 'Fallback' expression.
 * Returns { key, fallback } or null.
 */
function extractKeyFromCall(node) {
  let callNode = node;
  let fallback = null;

  // Detect  t('KEY') || 'Fallback'  →  BinaryExpression(BarBarToken)
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.BarBarToken
  ) {
    callNode = node.left;
    if (ts.isStringLiteralLike(node.right)) {
      fallback = node.right.text;
    }
  }

  if (!ts.isCallExpression(callNode) || callNode.arguments.length === 0) return null;

  const callee = callNode.expression;
  if (!ts.isIdentifier(callee)) return null;
  if (callee.text !== 't' && callee.text !== 'trans') return null;

  const firstArg = callNode.arguments[0];
  let key = null;
  if (ts.isStringLiteralLike(firstArg)) {
    key = firstArg.text;
  } else if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    key = firstArg.text;
  }

  return key ? { key, fallback } : null;
}

function extractUsedKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFromPath(filePath),
  );

  const keys = [];

  function visit(node) {
    const result = extractKeyFromCall(node);
    if (result && KEY_PATTERN.test(result.key)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      keys.push({ key: result.key, fallback: result.fallback, filePath, line: line + 1 });
      // Don't recurse into children — we already consumed the call
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\\\', '/');
}

function appendMissingKeys(tsvFile, missingKeys, fallbackMap) {
  const lines = [
    '',
    '// Auto-added by lint:i18n:update',
    '',
    ...missingKeys.map((key) => {
      const value = fallbackMap.get(key) ?? key;
      return `${key}\t${value}`;
    }),
    '',
  ];

  fs.appendFileSync(tsvFile, lines.join('\n'), 'utf8');
}

function main() {
  const definedKeys = readDefinedKeys(SOURCE_LOCALE);
  const files = SEARCH_DIRS.flatMap((directory) => walkFiles(directory));
  const usedEntries = files.flatMap((filePath) => extractUsedKeys(filePath));

  const usedKeys = new Set(usedEntries.map((entry) => entry.key));
  const missing = Array.from(usedKeys).filter((key) => !definedKeys.has(key)).sort();

  if (missing.length === 0) {
    console.log(`✅ i18n key check passed (${usedKeys.size} keys used, all present in src/i18n/en-US.tsv)`);
    return;
  }

  if (UPDATE_MODE) {
    // Build a map of key → fallback text from || 'Fallback' patterns
    const fallbackMap = new Map();
    for (const entry of usedEntries) {
      if (entry.fallback && !fallbackMap.has(entry.key)) {
        fallbackMap.set(entry.key, entry.fallback);
      }
    }
    appendMissingKeys(SOURCE_LOCALE, missing, fallbackMap);
    console.log(`🛠️ Added ${missing.length} missing key(s) to src/i18n/en-US.tsv`);
    return;
  }

  console.error(`❌ Missing ${missing.length} translation key(s) in src/i18n/en-US.tsv:`);

  for (const key of missing) {
    const match = usedEntries.find((entry) => entry.key === key);
    if (match) {
      console.error(`  - ${key}  (${relative(match.filePath)}:${match.line})`);
    } else {
      console.error(`  - ${key}`);
    }
  }

  process.exitCode = 1;
}

main();
