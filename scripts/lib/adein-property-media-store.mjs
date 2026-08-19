import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MEDIA_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

const detectContentType = (buffer) => {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
};

const extensionFor = (contentType) => contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];

export function createPropertyMediaStore({ rootDir, maxBytes = 8 * 1024 * 1024 }) {
  const root = path.resolve(rootDir);
  const safeStorageKey = (storageKey) => {
    if (typeof storageKey !== 'string' || !/^listings\/\d+\/[0-9a-f-]+\.(?:jpg|jpeg|png|webp)$/.test(storageKey)) {
      throw new Error('Referencia de imagen inválida');
    }
    const filePath = path.resolve(root, storageKey);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Referencia de imagen inválida');
    return filePath;
  };

  return {
    async saveUpload({ listingId, fileName, contentType, buffer }) {
      if (!/^\d+$/.test(String(listingId))) throw new Error('Listing inválido');
      if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > maxBytes) throw new Error('Tamaño de imagen inválido');
      const detectedType = detectContentType(buffer);
      if (!detectedType || !MEDIA_TYPES[detectedType]) throw new Error('Tipo de imagen no permitido');
      if (contentType && contentType.toLowerCase() !== detectedType) throw new Error('MIME de imagen no coincide con el archivo');
      const extension = path.extname(String(fileName || '')).slice(1).toLowerCase();
      if (!MEDIA_TYPES[detectedType].includes(extension)) throw new Error('Extensión de imagen no coincide con el archivo');
      const storageKey = `listings/${listingId}/${crypto.randomUUID()}.${extensionFor(detectedType)}`;
      const filePath = safeStorageKey(storageKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer, { flag: 'wx', mode: 0o640 });
      return {
        storageKey,
        contentType: detectedType,
        sizeBytes: buffer.length,
        checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
      };
    },
    async readPublic(storageKey) {
      const filePath = safeStorageKey(storageKey);
      try {
        return { buffer: await fs.readFile(filePath), filePath };
      } catch (error) {
        if (error?.code === 'ENOENT') throw new Error('Archivo de imagen no existe');
        throw error;
      }
    },
    async prepareDelete(storageKey) {
      const filePath = safeStorageKey(storageKey);
      const trashPath = `${filePath}.deleting-${crypto.randomUUID()}`;
      try {
        await fs.rename(filePath, trashPath);
      } catch (error) {
        if (error?.code === 'ENOENT') throw new Error('Archivo de imagen no existe');
        throw error;
      }
      let completed = false;
      return {
        async restore() {
          if (!completed) await fs.rename(trashPath, filePath);
        },
        async purge() {
          if (!completed) {
            await fs.unlink(trashPath);
            completed = true;
          }
        },
      };
    },
  };
}
