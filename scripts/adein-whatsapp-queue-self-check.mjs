import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWhatsappQueue } from './lib/adein-whatsapp-queue.mjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'adein-queue-self-check-'));
try {
  const queue = createWhatsappQueue(directory, () => 1722729600000);
  const result = await queue({ fileName: '../../chat de prueba.txt', content: 'Contenido sintético.' });
  assert.equal(result.sourceRef, '1722729600000-chat-de-prueba.txt');
  assert.equal(await fs.readFile(path.join(directory, result.sourceRef), 'utf8'), 'Contenido sintético.');
  await assert.rejects(() => queue({ fileName: 'chat.pdf', content: 'x' }), /Sólo se aceptan archivos .txt/);
  await assert.rejects(() => queue({ fileName: 'chat.txt', content: '' }), /Archivo vacío/);
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, checks: ['txt_only', 'safe_filename', 'entrada_write'] }));
