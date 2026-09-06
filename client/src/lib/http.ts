async function parseErrorBody(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error ?? `Request failed: ${res.status}`);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) return parseErrorBody(res);
  return res.json() as Promise<T>;
}

export async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) return parseErrorBody(res);
}
