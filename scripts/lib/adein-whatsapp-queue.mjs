import fs from 'node:fs/promises';
import path from 'node:path';

const safeFileName = (fileName, now) => {
  const base = path.basename(String(fileName ?? ''));
  if (path.extname(base).toLowerCase() !== '.txt') throw new Error('Sólo se aceptan archivos .txt');
  const stem = path.basename(base, path.extname(base))
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'chat';
  return `${now}-${stem}.txt`;
};

export function createWhatsappQueue(directory, getTimestamp = Date.now) {
  return async ({ fileName, content }) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Archivo vacío');
    const sourceRef = safeFileName(fileName, getTimestamp());
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(directory, sourceRef), content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return { sourceRef };
  };
}
