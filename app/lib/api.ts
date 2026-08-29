export const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No fue posible completar la solicitud.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
