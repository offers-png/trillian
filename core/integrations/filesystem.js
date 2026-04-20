const fs = require('fs');
const path = require('path');

function sandboxed(filePath) {
  const root = process.env.TRILLIAN_ROOT_DIR || path.join(require('os').homedir(), 'Documents', 'Trillian');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  const resolved = path.resolve(path.join(root, filePath));
  if (!resolved.startsWith(path.resolve(root))) throw new Error('Path outside sandbox');
  return resolved;
}

async function readFile({ path: filePath }) {
  const full = sandboxed(filePath);
  if (!fs.existsSync(full)) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(full, 'utf8');
  return { path: filePath, content: content.slice(0, 4000), size: content.length };
}

async function listFiles({ path: dirPath = '.', pattern = '*' } = {}) {
  const full = sandboxed(dirPath);
  if (!fs.existsSync(full)) return { files: [], path: dirPath };
  const files = fs.readdirSync(full).filter(f => {
    if (pattern === '*') return true;
    const ext = pattern.replace('*', '');
    return f.endsWith(ext);
  });
  return { files, path: dirPath, count: files.length };
}

async function createFile({ path: filePath, content }) {
  const full = sandboxed(filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (fs.existsSync(full)) throw new Error(`File already exists: ${filePath}. Use a different name or confirm overwrite.`);
  fs.writeFileSync(full, content, 'utf8');
  return { created: filePath, size: content.length };
}

module.exports = { readFile, listFiles, createFile };
