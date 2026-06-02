const crypto = require('crypto');

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function safeName(prefix, extension) {
  return `${prefix}/${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

class StorageService {
  constructor() {
    this.provider = process.env.STORAGE_PROVIDER || 'unconfigured';
    this.publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL || '';
  }

  isConfigured() {
    return this.provider !== 'unconfigured' && Boolean(this.publicBaseUrl);
  }

  async uploadImage({ fileUrl, fileData, mimeType, sizeBytes, caption }) {
    if (fileUrl) return { fileUrl };
    this.validateFile({ mimeType, sizeBytes, allowed: IMAGE_TYPES });
    if (fileData) {
      return { fileUrl: `data:${mimeType};base64,${fileData}` };
    }
    if (!this.isConfigured()) {
      const err = new Error('File storage is not configured yet.');
      err.status = 501;
      throw err;
    }
    return { fileUrl: `${this.publicBaseUrl}/${safeName('boat-photos', mimeType.split('/')[1] || 'jpg')}` };
  }

  async uploadDocument({ fileUrl, mimeType, sizeBytes }) {
    if (fileUrl) return { fileUrl };
    this.validateFile({ mimeType, sizeBytes, allowed: DOCUMENT_TYPES });
    if (!this.isConfigured()) {
      const err = new Error('File storage is not configured yet.');
      err.status = 501;
      throw err;
    }
    const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1] || 'bin';
    return { fileUrl: `${this.publicBaseUrl}/${safeName('boat-documents', ext)}` };
  }

  async deleteFile() {
    return { deleted: this.isConfigured() };
  }

  validateFile({ mimeType, sizeBytes, allowed }) {
    if (!mimeType || !allowed.has(mimeType)) {
      const err = new Error('Unsupported file type.');
      err.status = 400;
      throw err;
    }
    if (Number(sizeBytes || 0) > MAX_BYTES) {
      const err = new Error('File is too large.');
      err.status = 400;
      throw err;
    }
  }
}

module.exports = new StorageService();
