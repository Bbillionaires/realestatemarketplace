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

export interface UnitSummary {
  id: string;
  propertyId: string;
  unitLabel: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  rentCents: number | null;
  isAvailable: boolean;
}

export interface PropertySummary {
  id: string;
  title: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  description: string | null;
  monthlyRentCents: number | null;
  depositCents: number | null;
  petPolicy: string | null;
  photoUrl: string | null;
  landlordDisplayName: string;
  units: UnitSummary[];
  isActive: boolean;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  profile: { displayName: string } | null;
}

export interface ConversationSummary {
  id: string;
  property: { id: string; title: string; addressLine1: string; city: string; state: string };
  unitId: string | null;
  tenantDisplayName: string;
  landlordDisplayName: string;
  relayPhoneNumber: string | null;
  status: string;
  applicationStatus: string;
  leaseStatus: string;
  moderationStatus: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderDisplayName: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: 'SMS' | 'IN_APP';
  content: string;
  moderationDecision: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}

export interface StartConversationResult {
  conversation: ConversationSummary;
  message: MessageSummary;
  delivered: boolean;
  guidance?: string;
}

export interface SendMessageResult {
  message: MessageSummary;
  delivered: boolean;
  guidance?: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<TokenPair>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: { email: string; password: string; displayName: string; role: string }) =>
    request<TokenPair>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: (accessToken: string) => request<CurrentUser>('/users/me', {}, accessToken),
  listProperties: (accessToken: string) => request<PropertySummary[]>('/properties', {}, accessToken),
  getProperty: (accessToken: string, id: string) => request<PropertySummary>(`/properties/${id}`, {}, accessToken),
  listConversations: (accessToken: string) =>
    request<ConversationSummary[]>('/conversations', {}, accessToken),
  getConversation: (accessToken: string, id: string) =>
    request<ConversationSummary>(`/conversations/${id}`, {}, accessToken),
  startConversation: (accessToken: string, payload: { propertyId: string; unitId?: string; message: string }) =>
    request<StartConversationResult>('/conversations', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  listMessages: (accessToken: string, conversationId: string) =>
    request<MessageSummary[]>(`/conversations/${conversationId}/messages`, {}, accessToken),
  sendMessage: (accessToken: string, conversationId: string, content: string) =>
    request<SendMessageResult>(
      `/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
      accessToken,
    ),
};
