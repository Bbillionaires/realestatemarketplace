const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiError {
  error: { code: number; message: string | string[]; path: string; timestamp: string };
}

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    const message = body?.error?.message ?? res.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return body as T;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface PropertySummary {
  id: string;
  title: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  monthlyRentCents: number | null;
  landlordDisplayName: string;
  isActive: boolean;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  profile: { displayName: string } | null;
}

export const api = {
  login: (email: string, password: string) =>
    request<TokenPair>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: { email: string; password: string; displayName: string; role: string }) =>
    request<TokenPair>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: (accessToken: string) => request<CurrentUser>('/users/me', {}, accessToken),
  listProperties: (accessToken: string) =>
    request<PropertySummary[]>('/properties', {}, accessToken),
};
