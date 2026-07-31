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
  sellingSoon: boolean;
  sellingSoonNote: string | null;
  rentToOwnAvailable: boolean;
  leaseToOwnAvailable: boolean;
  sellerFinancingAvailable: boolean;
  workForRentAvailable: boolean;
  tenantSwapAllowed: boolean;
  ownerId?: string;
  managerIds?: string[];
}

export interface UpdatePropertyPayload {
  sellingSoon?: boolean;
  sellingSoonNote?: string;
  rentToOwnAvailable?: boolean;
  leaseToOwnAvailable?: boolean;
  sellerFinancingAvailable?: boolean;
  workForRentAvailable?: boolean;
  tenantSwapAllowed?: boolean;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  canSuspendUsers: boolean;
  profile: { displayName: string } | null;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  canSuspendUsers: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: { displayName: string } | null;
}

export interface ConversationSummary {
  id: string;
  property: { id: string; title: string; addressLine1: string; city: string; state: string };
  unitId: string | null;
  unitLabel: string | null;
  tenantDisplayName: string;
  landlordDisplayName: string;
  relayPhoneNumber: string | null;
  status: string;
  applicationStatus: string;
  leaseStatus: string;
  moderationStatus: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  hasUnread: boolean;
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

export interface ShowingTimeSlot {
  id: string;
  proposedBy: string;
  startTime: string;
  endTime: string;
  isSelected: boolean;
}

export interface ShowingSummary {
  id: string;
  conversationId: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  timeSlots: ShowingTimeSlot[];
}

export interface ModerationFlagSummary {
  id: string;
  status: string;
  flagType: string;
  detectionMethod: string;
  confidenceScore: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  decision: string | null;
  message: { id: string; originalContent: string; sanitizedContent: string | null; createdAt: string };
  conversation: { id: string; propertyTitle: string };
  flaggedUser: { id: string; email: string; displayName: string; role: string; isActive: boolean } | null;
}

export interface ViolationSummary {
  id: string;
  conversationId: string;
  messageId: string;
  violationType: string;
  detectionMethod: string;
  confidenceScore: number;
  actionTaken: string;
  createdAt: string;
}

export interface RestrictionSummary {
  id: string;
  userId: string;
  type: string;
  reason: string;
  imposedByName: string | null;
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  isActive: boolean;
}

export interface AdminNoteSummary {
  id: string;
  conversationId: string | null;
  authorName: string;
  note: string;
  createdAt: string;
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
  updateProperty: (accessToken: string, id: string, payload: UpdatePropertyPayload) =>
    request<PropertySummary>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, accessToken),
  listConversations: (accessToken: string, filters: { propertyId?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.propertyId) params.set('propertyId', filters.propertyId);
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    return request<ConversationSummary[]>(`/conversations${qs ? `?${qs}` : ''}`, {}, accessToken);
  },
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
  listShowings: (accessToken: string, conversationId: string) =>
    request<ShowingSummary[]>(`/conversations/${conversationId}/showings`, {}, accessToken),
  proposeShowing: (accessToken: string, conversationId: string, startTime: string, durationMinutes?: number) =>
    request<ShowingSummary>(
      `/conversations/${conversationId}/showings`,
      { method: 'POST', body: JSON.stringify({ startTime, durationMinutes }) },
      accessToken,
    ),
  acceptShowingSlot: (accessToken: string, conversationId: string, showingId: string, slotId: string) =>
    request<ShowingSummary>(
      `/conversations/${conversationId}/showings/${showingId}/slots/${slotId}/accept`,
      { method: 'PATCH' },
      accessToken,
    ),
  cancelShowing: (accessToken: string, conversationId: string, showingId: string) =>
    request<ShowingSummary>(
      `/conversations/${conversationId}/showings/${showingId}/cancel`,
      { method: 'PATCH' },
      accessToken,
    ),
  listModerationFlags: (accessToken: string, status?: string) =>
    request<ModerationFlagSummary[]>(
      `/moderation/flags${status ? `?status=${status}` : ''}`,
      {},
      accessToken,
    ),
  reviewModerationFlag: (accessToken: string, flagId: string, status: string, note?: string) =>
    request<ModerationFlagSummary>(
      `/moderation/flags/${flagId}/review`,
      { method: 'PATCH', body: JSON.stringify({ status, note }) },
      accessToken,
    ),
  listUserViolations: (accessToken: string, userId: string) =>
    request<ViolationSummary[]>(`/moderation/users/${userId}/violations`, {}, accessToken),
  listUserRestrictions: (accessToken: string, userId: string) =>
    request<RestrictionSummary[]>(`/moderation/users/${userId}/restrictions`, {}, accessToken),
  imposeRestriction: (
    accessToken: string,
    userId: string,
    payload: { type: string; reason: string; durationHours?: number },
  ) =>
    request<RestrictionSummary>(
      `/moderation/users/${userId}/restrictions`,
      { method: 'POST', body: JSON.stringify(payload) },
      accessToken,
    ),
  liftRestriction: (accessToken: string, restrictionId: string) =>
    request<RestrictionSummary>(`/moderation/restrictions/${restrictionId}/lift`, { method: 'POST' }, accessToken),
  listConversationNotes: (accessToken: string, conversationId: string) =>
    request<AdminNoteSummary[]>(`/moderation/conversations/${conversationId}/notes`, {}, accessToken),
  addConversationNote: (accessToken: string, conversationId: string, note: string) =>
    request<AdminNoteSummary>(
      `/moderation/conversations/${conversationId}/notes`,
      { method: 'POST', body: JSON.stringify({ note }) },
      accessToken,
    ),
  listUsers: (accessToken: string, role?: string) =>
    request<UserSummary[]>(`/users${role ? `?role=${role}` : ''}`, {}, accessToken),
  suspendUser: (accessToken: string, userId: string) =>
    request<UserSummary>(`/users/${userId}/suspend`, { method: 'PATCH' }, accessToken),
  restoreUser: (accessToken: string, userId: string) =>
    request<UserSummary>(`/users/${userId}/restore`, { method: 'PATCH' }, accessToken),
  setSuspendPermission: (accessToken: string, userId: string, enabled: boolean) =>
    request<UserSummary>(
      `/users/${userId}/suspend-permission`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) },
      accessToken,
    ),
};
