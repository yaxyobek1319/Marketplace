export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      ...options.headers,
    },
    cache: 'no-store',
  });
  const value = await response.json().catch(() => ({ message: 'Javobni o‘qib bo‘lmadi' }));
  if (!response.ok) {
    const raw = value.message;
    const message =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw.join(', ')
          : raw?.fieldErrors
            ? Object.entries(raw.fieldErrors)
                .map(([key, v]) => `${key}: ${(v as string[]).join(', ')}`)
                .join('; ')
            : 'Amal bajarilmadi';
    throw new ApiError(response.status, message);
  }
  return value as T;
}
export const mutate = <T = unknown>(path: string, data?: unknown, method = 'POST') =>
  api<T>(path, { method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
export type Actor = {
  id: string;
  type: 'USER' | 'STAFF';
  sellerId?: string;
  permissions: string[];
};
export type Row = Record<string, any>;
export const money = (value: unknown) =>
  `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(Number(value ?? 0))} so‘m`;
export const date = (value: unknown) => {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
