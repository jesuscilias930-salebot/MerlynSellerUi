// A failure in the leads/list must not prevent the open conversation from updating.
export async function refreshIndependently(tasks: Array<() => Promise<unknown>>) {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export async function refreshAfterAcceptedUpload(refresh: () => Promise<void>): Promise<string | null> {
  try { await refresh(); return null; }
  catch {
    return 'Archivo aceptado para envío. No pudimos actualizar el chat; se sincronizará al recuperar la conexión. No necesitas reenviarlo.';
  }
}
