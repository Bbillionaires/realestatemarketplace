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

/** Like request(), but sends a FormData body (no Content-Type set manually — the
 * browser adds the multipart boundary) for endpoints that accept a file upload. */
async function requestMultipart<T>(path: string, formData: FormData, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/api${path}`, { method: 'POST', body: formData, headers });
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

export type PropertyType = 'APARTMENT' | 'HOUSE' | 'CONDO' | 'TOWNHOME' | 'OTHER';
export type UtilityType = 'ELECTRIC' | 'WATER' | 'GAS' | 'TRASH' | 'LAWN_SERVICE' | 'INTERNET' | 'CABLE' | 'PARKING';

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
  propertyType: PropertyType;
  acceptsSection8Vouchers: boolean;
  amenities: string | null;
  utilitiesIncluded: UtilityType[];
  subleaseAllowed: boolean;
  currentLeaseEndDate: string | null;
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
  propertyType?: PropertyType;
  acceptsSection8Vouchers?: boolean;
  amenities?: string;
  utilitiesIncluded?: UtilityType[];
  subleaseAllowed?: boolean;
  currentLeaseEndDate?: string;
  sellingSoon?: boolean;
  sellingSoonNote?: string;
  rentToOwnAvailable?: boolean;
  leaseToOwnAvailable?: boolean;
  sellerFinancingAvailable?: boolean;
  workForRentAvailable?: boolean;
  tenantSwapAllowed?: boolean;
}

export interface CreatePropertyPayload {
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  description?: string;
  monthlyRentCents?: number;
  depositCents?: number;
  petPolicy?: string;
  propertyType?: PropertyType;
  acceptsSection8Vouchers?: boolean;
  amenities?: string;
  utilitiesIncluded?: UtilityType[];
  subleaseAllowed?: boolean;
  currentLeaseEndDate?: string;
  leaseToOwnAvailable?: boolean;
  sellerFinancingAvailable?: boolean;
}

export interface CreateUnitPayload {
  unitLabel: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  rentCents?: number;
  isAvailable?: boolean;
}

export interface AgencySummary {
  id: string;
  displayName: string;
  managedPropertyCount: number;
}

export interface RentEstimate {
  estimatedMonthlyRentCents: number | null;
  sampleSize: number;
  city?: string;
  state?: string;
  bedrooms?: number;
}

export interface WaitlistEntry {
  id: string;
  propertyId: string;
  userId: string;
  displayName: string;
  note: string | null;
  createdAt: string;
  property?: { id: string; title: string; addressLine1: string; city: string; state: string };
}

export type LenderAccessTier = 'BASIC' | 'PREMIUM';
export type LenderRequestStatus = 'PENDING' | 'FULFILLED' | 'DECLINED';

export interface LenderAssignment {
  id: string;
  propertyId: string;
  propertyTitle: string;
  lenderId: string;
  lenderDisplayName: string;
  tenantId: string | null;
  tenantDisplayName: string | null;
  accessTier: LenderAccessTier;
  assignedAt: string;
  revokedAt: string | null;
}

export interface LenderRequest {
  id: string;
  lenderAssignmentId: string;
  propertyId: string;
  propertyTitle: string;
  message: string | null;
  status: LenderRequestStatus;
  responseNote: string | null;
  responseFileName: string | null;
  emailSent: boolean;
  createdAt: string;
  respondedAt: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  canSuspendUsers: boolean;
  profile: {
    displayName: string;
    hasLawnCareProvider?: boolean;
    hasPlumbingProvider?: boolean;
    hasHandymanProvider?: boolean;
    hasPestControlProvider?: boolean;
    hasRoofingProvider?: boolean;
    requestsPropertyManagementHelp?: boolean;
  } | null;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  canSuspendUsers: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: {
    displayName: string;
    hasLawnCareProvider?: boolean;
    hasPlumbingProvider?: boolean;
    hasHandymanProvider?: boolean;
    hasPestControlProvider?: boolean;
    hasRoofingProvider?: boolean;
    requestsPropertyManagementHelp?: boolean;
  } | null;
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
  register: (payload: {
    email: string;
    password: string;
    displayName: string;
    role: string;
    hasLawnCareProvider?: boolean;
    hasPlumbingProvider?: boolean;
    hasHandymanProvider?: boolean;
    hasPestControlProvider?: boolean;
    hasRoofingProvider?: boolean;
    requestsPropertyManagementHelp?: boolean;
  }) => request<TokenPair>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: (accessToken: string) => request<CurrentUser>('/users/me', {}, accessToken),
  listProperties: (accessToken: string, filters: { type?: string; section8?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.section8) params.set('section8', 'true');
    const qs = params.toString();
    return request<PropertySummary[]>(`/properties${qs ? `?${qs}` : ''}`, {}, accessToken);
  },
  getProperty: (accessToken: string, id: string) => request<PropertySummary>(`/properties/${id}`, {}, accessToken),
  createProperty: (accessToken: string, payload: CreatePropertyPayload) =>
    request<PropertySummary>('/properties', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  updateProperty: (accessToken: string, id: string, payload: UpdatePropertyPayload) =>
    request<PropertySummary>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, accessToken),
  createUnit: (accessToken: string, propertyId: string, payload: CreateUnitPayload) =>
    request<UnitSummary>(`/properties/${propertyId}/units`, { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  updateUnit: (accessToken: string, propertyId: string, unitId: string, payload: Partial<CreateUnitPayload>) =>
    request<UnitSummary>(
      `/properties/${propertyId}/units/${unitId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      accessToken,
    ),
  listAgencies: (accessToken: string) => request<AgencySummary[]>('/properties/agencies', {}, accessToken),
  getRentEstimate: (accessToken: string, params: { city?: string; state?: string; bedrooms?: number }) => {
    const qs = new URLSearchParams();
    if (params.city) qs.set('city', params.city);
    if (params.state) qs.set('state', params.state);
    if (params.bedrooms !== undefined) qs.set('bedrooms', String(params.bedrooms));
    return request<RentEstimate>(`/properties/rent-estimate?${qs.toString()}`, {}, accessToken);
  },
  joinWaitlist: (accessToken: string, propertyId: string, note?: string) =>
    request<WaitlistEntry>(
      `/properties/${propertyId}/waitlist`,
      { method: 'POST', body: JSON.stringify({ note }) },
      accessToken,
    ),
  leaveWaitlist: (accessToken: string, propertyId: string) =>
    request<void>(`/properties/${propertyId}/waitlist`, { method: 'DELETE' }, accessToken),
  listPropertyWaitlist: (accessToken: string, propertyId: string) =>
    request<WaitlistEntry[]>(`/properties/${propertyId}/waitlist`, {}, accessToken),
  listMyWaitlists: (accessToken: string) => request<WaitlistEntry[]>('/properties/waitlists/me', {}, accessToken),
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
  createLenderAssignment: (
    accessToken: string,
    payload: { propertyId: string; lenderId: string; tenantId?: string; accessTier?: LenderAccessTier },
  ) => request<LenderAssignment>('/lenders/assignments', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  listLenderAssignments: (accessToken: string, filters: { propertyId?: string; lenderId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.propertyId) params.set('propertyId', filters.propertyId);
    if (filters.lenderId) params.set('lenderId', filters.lenderId);
    const qs = params.toString();
    return request<LenderAssignment[]>(`/lenders/assignments${qs ? `?${qs}` : ''}`, {}, accessToken);
  },
  updateLenderAssignment: (
    accessToken: string,
    id: string,
    payload: { tenantId?: string | null; accessTier?: LenderAccessTier },
  ) => request<LenderAssignment>(`/lenders/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, accessToken),
  revokeLenderAssignment: (accessToken: string, id: string) =>
    request<LenderAssignment>(`/lenders/assignments/${id}/revoke`, { method: 'PATCH' }, accessToken),
  listMyLenderAssignments: (accessToken: string) =>
    request<LenderAssignment[]>('/lenders/assignments/me', {}, accessToken),
  createLenderRequest: (accessToken: string, assignmentId: string, message?: string) =>
    request<LenderRequest>(
      `/lenders/assignments/${assignmentId}/requests`,
      { method: 'POST', body: JSON.stringify({ message }) },
      accessToken,
    ),
  listLenderRequestsForAssignment: (accessToken: string, assignmentId: string) =>
    request<LenderRequest[]>(`/lenders/assignments/${assignmentId}/requests`, {}, accessToken),
  listMyLenderRequests: (accessToken: string) => request<LenderRequest[]>('/lenders/requests/me', {}, accessToken),
  submitLenderRequest: (accessToken: string, requestId: string, responseNote?: string, file?: File) => {
    const formData = new FormData();
    if (responseNote) formData.set('responseNote', responseNote);
    if (file) formData.set('file', file);
    return requestMultipart<LenderRequest>(`/lenders/requests/${requestId}/submit`, formData, accessToken);
  },
  declineLenderRequest: (accessToken: string, requestId: string) =>
    request<LenderRequest>(`/lenders/requests/${requestId}/decline`, { method: 'PATCH' }, accessToken),
};
