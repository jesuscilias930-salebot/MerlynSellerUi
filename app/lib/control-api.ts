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
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(typeof body === "string" ? body : body?.message || body?.error || "No fue posible completar la solicitud de Control.");
  return body as T;
}

export { controlApi };
