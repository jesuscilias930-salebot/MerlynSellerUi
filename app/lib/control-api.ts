const controlApi = process.env.NEXT_PUBLIC_CONTROL_API_URL || "http://localhost:8080";
const tokenKey = "sock_control_token";

export const controlSession = {
  get: () => typeof window === "undefined" ? null : localStorage.getItem(tokenKey),
  set: (token: string) => localStorage.setItem(tokenKey, token),
  clear: () => localStorage.removeItem(tokenKey),
};

export async function controlRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = controlSession.get();
  const response = await fetch(`${controlApi}${path}`, {
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const body = (await response.json().catch(() => undefined)) as unknown;
  const errorBody = body && typeof body === "object" ? body as { message?: string; error?: string } : undefined;
  if (!response.ok) throw new Error(typeof body === "string" ? body : errorBody?.message || errorBody?.error || "No fue posible completar la solicitud de Control.");
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
