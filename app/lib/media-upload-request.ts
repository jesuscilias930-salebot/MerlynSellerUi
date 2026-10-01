// No automatic retry: the API may have accepted a message before the connection broke.
export async function mediaUploadRequest(url: string, init: RequestInit, uploadId: string): Promise<Response> {
  const started = Date.now();
  try {
    const headers = new Headers(init.headers);
    headers.set('X-Upload-Id', uploadId);
    return await fetch(url, { ...init, headers });
  } catch {
    const seconds = Math.round((Date.now() - started) / 1000);
    throw new Error(`Se interrumpió la conexión al subir o procesar el archivo (${seconds} s). No pudimos confirmar el envío. Revisa el chat antes de reintentar. Referencia: ${uploadId}`);
  }
}
