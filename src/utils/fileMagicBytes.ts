const MAGIC_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'video/mp4': [[0x00, 0x00, 0x00]],
  'video/webm': [[0x1a, 0x45, 0xdf, 0xa3]],
  'audio/mpeg': [[0xff, 0xfb], [0x49, 0x44, 0x33]],
  'audio/ogg': [[0x4f, 0x67, 0x67, 0x53]],
  'audio/webm': [[0x1a, 0x45, 0xdf, 0xa3]],
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.ms-excel': [[0x50, 0x4b, 0x03, 0x04], [0xd0, 0xcf, 0x11, 0xe0]],
  'application/msword': [[0x50, 0x4b, 0x03, 0x04], [0xd0, 0xcf, 0x11, 0xe0]],
};

function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] === undefined) continue;
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

export function validateImportFileContent(buffer: Buffer, ext: string): boolean {
  const normalizedExt = ext.toLowerCase();
  if (normalizedExt === '.csv') {
    const sample = buffer.subarray(0, Math.min(512, buffer.length));
    return sample.length > 0 && !sample.includes(0);
  }
  if (normalizedExt === '.xlsx') {
    return validateFileMagicBytes(
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }
  if (normalizedExt === '.xls') {
    return validateFileMagicBytes(buffer, 'application/vnd.ms-excel');
  }
  return false;
}

export function validateFileMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const normalized = mimetype.split(';')[0].trim().toLowerCase();
  const signatures = MAGIC_SIGNATURES[normalized];

  if (!signatures) {
    return false;
  }

  if (normalized === 'video/mp4') {
    if (buffer.length < 12) return false;
    const ftyp = buffer.slice(4, 8).toString('ascii');
    return ftyp === 'ftyp';
  }

  return signatures.some((sig) => matchesSignature(buffer, sig));
}
