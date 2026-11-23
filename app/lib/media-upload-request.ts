/** Avance de una subida: 0 a 1 mientras se envía el archivo; «processing» cuando el servidor ya lo tiene y lo prepara. */
export type UploadProgress = (progress: { fraction: number; phase: "uploading" | "processing" }) => void;

const interrupted = (started: number, uploadId: string) => new Error(`Se interrumpió la conexión al subir o procesar el archivo (${Math.round((Date.now() - started) / 1000)} s). No pudimos confirmar el envío. Revisa el chat antes de reintentar. Referencia: ${uploadId}`);

// No automatic retry: the API may have accepted a message before the connection broke.
export async function mediaUploadRequest(url: string, init: RequestInit, uploadId: string, onProgress?: UploadProgress): Promise<Response> {
  const started = Date.now();
  const headers = new Headers(init.headers);
  headers.set('X-Upload-Id', uploadId);
  // fetch no informa el avance de la subida: con onProgress se usa XMLHttpRequest.
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init.method || 'POST', url);
      xhr.withCredentials = init.credentials === 'include';
      headers.forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = event => { if (event.lengthComputable && event.total > 0) onProgress({ fraction: Math.min(1, event.loaded / event.total), phase: 'uploading' }); };
      xhr.upload.onload = () => onProgress({ fraction: 1, phase: 'processing' });
      xhr.onload = () => resolve(new Response(xhr.status === 204 ? null : xhr.responseText, { status: xhr.status, headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json' } }));
      xhr.onerror = () => reject(interrupted(started, uploadId));
      xhr.onabort = () => reject(interrupted(started, uploadId));
      xhr.ontimeout = () => reject(interrupted(started, uploadId));
      onProgress({ fraction: 0, phase: 'uploading' });
      xhr.send(init.body as XMLHttpRequestBodyInit);
    });
  }
  try {
    return await fetch(url, { ...init, headers });
  } catch {
    throw interrupted(started, uploadId);
  }
}

/** Texto del avance para la burbuja del video. */
export function progressLabel(progress: { phase?: string; fraction?: number } | undefined): string {
  if (!progress?.phase || progress.phase === 'checking') return 'Preparando envío…';
  if (progress.phase === 'uploading') return `Subiendo ${Math.round((progress.fraction || 0) * 100)} %`;
  return 'Subido 100 % · preparando para WhatsApp…';
}
