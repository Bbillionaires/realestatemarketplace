/**
 * Builds a safe Content-Disposition header value for serving a user-supplied
 * filename back over HTTP — the first place in this codebase that emits a
 * filename into a response header, so it sanitizes rather than trusting the
 * stored `originalname` outright (strips CR/LF and quotes to prevent header
 * injection, ASCII-folds the primary `filename=` for older clients, and adds
 * an RFC 5987 `filename*=UTF-8''...` fallback for non-ASCII names).
 */
export function buildContentDisposition(fileName: string, mode: 'inline' | 'attachment'): string {
  const cleaned = fileName.replace(/[\r\n"]/g, '');
  const asciiFallback = cleaned.replace(/[^\x20-\x7E]/g, '_') || 'download';
  const encoded = encodeURIComponent(cleaned);
  return `${mode}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
