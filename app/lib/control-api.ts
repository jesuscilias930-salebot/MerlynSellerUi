const controlApi = process.env.NEXT_PUBLIC_CONTROL_API_URL || "http://localhost:8080";
const tokenKey = "sock_control_token";

export const controlSession = {
  get: () => typeof window === "undefined" ? null : localStorage.getItem(tokenKey),
  set: (token: string) => localStorage.setItem(tokenKey, token),
  clear: () => localStorage.removeItem(tokenKey),
};

export function controlStatusMessage(status: number): string {
  if (status === 413) return "Control rechazó el archivo por tamaño (413). Si acabas de subir el límite, reinicia o vuelve a desplegar Control.";
  if (status === 401) return "Tu sesión de Control expiró (401). Vuelve a iniciar sesión en Control.";
  if (status === 403) return "Control rechazó la solicitud (403). Tu sesión de Control pudo expirar: cierra sesión de Control y vuelve a entrar.";
  if (status >= 500) return `Control tuvo un error interno (${status}). Revisa la consola de Control.`;
  return `No fue posible completar la solicitud de Control (${status}).`;
}

export async function controlRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = controlSession.get();
  const response = await fetch(`${controlApi}${path}`, {
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const body = (await response.json().catch(() => undefined)) as unknown;
  const errorBody = body && typeof body === "object" ? body as { message?: string; error?: string } : undefined;
  if (!response.ok) throw new Error(typeof body === "string" ? body : errorBody?.message || (response.status === 401 || response.status === 403 || response.status === 413 || response.status >= 500 ? controlStatusMessage(response.status) : errorBody?.error || controlStatusMessage(response.status)));
  return body as T;
}

export async function loginControl(identifier: string, password: string, timeoutMs = 30000): Promise<string> {
  // Never reuse another account's bearer token during credential authentication.
  controlSession.clear();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await controlRequest<{ token: string }>("/auth/login", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({ identifier: identifier.trim().includes("@") ? identifier.trim().toLowerCase() : identifier.trim(), password }),
    });
    if (!result || typeof result.token !== "string" || !result.token.trim()) {
      throw new Error("Control Socks no devolvió una sesión válida.");
    }
    controlSession.set(result.token);
    return result.token;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Control Socks tardó demasiado en responder. Intenta iniciar sesión nuevamente.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { controlApi };
