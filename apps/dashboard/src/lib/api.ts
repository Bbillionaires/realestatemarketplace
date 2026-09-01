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

export type UnitListingType = 'ENTIRE_PLACE' | 'PRIVATE_ROOM' | 'SHARED_ROOM';

export interface BedSummary {
  id: string;
  unitId: string;
  bedLabel: string;
  rentCents: number | null;
  isAvailable: boolean;
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
  listingType: UnitListingType;
  beds: BedSummary[];
}

export type PropertyType = 'APARTMENT' | 'HOUSE' | 'CONDO' | 'TOWNHOME' | 'OTHER';
export type UtilityType = 'ELECTRIC' | 'WATER' | 'GAS' | 'TRASH' | 'LAWN_SERVICE' | 'INTERNET' | 'CABLE' | 'PARKING';
export type SewerSourceType = 'CITY_SEWER' | 'SEPTIC';
export type WaterSourceType = 'CITY_WATER' | 'WELL';

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
  sewerSource: SewerSourceType | null;
  waterSource: WaterSourceType | null;
  landlordPaysElectricity: boolean;
  landlordPaysWater: boolean;
  subleaseAllowed: boolean;
  currentLeaseEndDate: string | null;
  sellingSoon: boolean;
  sellingSoonNote: string | null;
  rentToOwnAvailable: boolean;
  leaseToOwnAvailable: boolean;
  sellerFinancingAvailable: boolean;
  workForRentAvailable: boolean;
  tenantSwapAllowed: boolean;
  secondChanceFriendly: boolean;
  brokenLeaseOk: boolean;
  cosignerAccepted: boolean;
  noCreditCheckIncomeOnly: boolean;
  evictionAgeToleranceYears: number | null;
  hasRoomRentals: boolean;
  hqsPreInspected: boolean;
  boostedUntil: string | null;
  viewCount: number;
  ownerId?: string;
  managerIds?: string[];
  boostCheckoutUrl?: string | null;
}

export interface PropertySearchFilters {
  section8?: boolean;
  secondChance?: boolean;
  roomRentals?: boolean;
  brokenLeaseOk?: boolean;
  cosignerAccepted?: boolean;
  noCreditCheckIncomeOnly?: boolean;
  maxEvictionYears?: number;
  utilitiesIncluded?: boolean;
  landlordPaysWater?: boolean;
  landlordPaysElectricity?: boolean;
  rentToOwn?: boolean;
}

/** Shared by listProperties/getPropertyPreview so both build the same query string. */
function searchFiltersToParams(filters: PropertySearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.section8) params.set('section8', 'true');
  if (filters.secondChance) params.set('secondChance', 'true');
  if (filters.roomRentals) params.set('roomRentals', 'true');
  if (filters.brokenLeaseOk) params.set('brokenLeaseOk', 'true');
  if (filters.cosignerAccepted) params.set('cosignerAccepted', 'true');
  if (filters.noCreditCheckIncomeOnly) params.set('noCreditCheckIncomeOnly', 'true');
  if (filters.maxEvictionYears !== undefined) params.set('maxEvictionYears', String(filters.maxEvictionYears));
  if (filters.utilitiesIncluded) params.set('utilitiesIncluded', 'true');
  if (filters.landlordPaysWater) params.set('landlordPaysWater', 'true');
  if (filters.landlordPaysElectricity) params.set('landlordPaysElectricity', 'true');
  if (filters.rentToOwn) params.set('rentToOwn', 'true');
  return params;
}

export interface UpdatePropertyPayload {
  propertyType?: PropertyType;
  acceptsSection8Vouchers?: boolean;
  amenities?: string;
  utilitiesIncluded?: UtilityType[];
  sewerSource?: SewerSourceType;
  waterSource?: WaterSourceType;
  landlordPaysElectricity?: boolean;
  landlordPaysWater?: boolean;
  subleaseAllowed?: boolean;
  currentLeaseEndDate?: string;
  sellingSoon?: boolean;
  sellingSoonNote?: string;
  rentToOwnAvailable?: boolean;
  leaseToOwnAvailable?: boolean;
  sellerFinancingAvailable?: boolean;
  workForRentAvailable?: boolean;
  tenantSwapAllowed?: boolean;
  secondChanceFriendly?: boolean;
  brokenLeaseOk?: boolean;
  cosignerAccepted?: boolean;
  noCreditCheckIncomeOnly?: boolean;
  evictionAgeToleranceYears?: number;
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
  sewerSource?: SewerSourceType;
  waterSource?: WaterSourceType;
  landlordPaysElectricity?: boolean;
  landlordPaysWater?: boolean;
  subleaseAllowed?: boolean;
  currentLeaseEndDate?: string;
  leaseToOwnAvailable?: boolean;
  sellerFinancingAvailable?: boolean;
  secondChanceFriendly?: boolean;
  brokenLeaseOk?: boolean;
  cosignerAccepted?: boolean;
  noCreditCheckIncomeOnly?: boolean;
  evictionAgeToleranceYears?: number;
}

export interface CreateUnitPayload {
  unitLabel: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  rentCents?: number;
  isAvailable?: boolean;
  listingType?: UnitListingType;
}

export interface CreateBedPayload {
  bedLabel: string;
  rentCents?: number;
  isAvailable?: boolean;
}

export type SchoolLevel = 'PRESCHOOL' | 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'OTHER';
export type SchoolType = 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'OTHER';

export interface NearbySchool {
  id: string;
  name: string;
  schoolType: SchoolType;
  level: SchoolLevel;
  rating: number | null;
  distanceMiles: number | null;
  address: string | null;
  websiteUrl: string | null;
}

export interface AgencySummary {
  id: string;
  displayName: string;
  managedPropertyCount: number;
}

export interface RentEstimate {
  estimatedMonthlyRentCents: number | null;
  sampleSize: number;
  radiusMiles: number;
  bedrooms?: number;
  addressResolved: boolean;
}

export interface VoucherMatch {
  zip: string;
  bedrooms: number;
  paymentStandardCents: number | null;
  metroArea: string | null;
  effectiveDate: string | null;
  covered: boolean;
  matches: PropertySummary[];
}

export type SubscriptionTier = 'FREE' | 'PRO' | 'UNLIMITED';

export interface Subscription {
  tier: SubscriptionTier;
  expiresAt: string | null;
  isActive: boolean;
  pendingTier: SubscriptionTier | null;
  checkoutUrl: string | null;
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

export type GigJobStatus = 'OPEN' | 'CLAIMED' | 'COMPLETED' | 'CONFIRMED' | 'CANCELLED';
export type GigVoucherStatus = 'ISSUED' | 'APPLIED';

export interface GigJob {
  id: string;
  posterId: string;
  posterDisplayName: string;
  posterRole: string;
  propertyId: string | null;
  propertyTitle: string | null;
  title: string;
  description: string;
  payoutCents: number;
  status: GigJobStatus;
  claimedById: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  checkoutUrl: string | null;
  createdAt: string;
}

export interface GigVoucher {
  id: string;
  gigJobId: string;
  gigJobTitle: string;
  tenantId: string;
  tenantDisplayName: string;
  landlordId: string;
  landlordDisplayName: string;
  payoutCents: number;
  feeCents: number;
  voucherCents: number;
  status: GigVoucherStatus;
  appliedAt: string | null;
  appliedNote: string | null;
  createdAt: string;
}

export type JobReferralStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'CLOSED';
export type JobReferralPendingOperation = 'ACTIVATE' | 'TOPUP' | 'RENEW';

export interface JobReferral {
  id: string;
  posterId: string;
  posterDisplayName: string;
  posterRole: string;
  title: string;
  employerName: string;
  location: string;
  applyUrl: string | null;
  contactInfo: string | null;
  description: string | null;
  status: JobReferralStatus;
  closedAt: string | null;
  createdAt: string;
  sponsored: boolean;
  costPerClickCents: number | null;
  monthlyFeeCents: number | null;
  budgetRemainingCents: number;
  clickCount: number;
  currentPeriodEnd: string | null;
  pendingOperation: JobReferralPendingOperation | null;
  checkoutUrl: string | null;
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
  bedId: string | null;
  bedLabel: string | null;
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

export type IdSubmissionStatus = 'AWAITING_PAYMENT' | 'PAID' | 'SUBMITTED' | 'CANCELLED';

export interface IdSubmissionSummary {
  id: string;
  conversationId: string;
  feeCents: number;
  status: IdSubmissionStatus;
  checkoutUrl: string | null;
  paidAt: string | null;
  submittedFileName: string | null;
  emailSent: boolean;
  submittedAt: string | null;
  createdAt: string;
}

export type HqsInspectionStatus = 'AWAITING_PAYMENT' | 'PAID' | 'REQUESTED' | 'CANCELLED';

export interface HqsInspectionSummary {
  id: string;
  propertyId: string;
  feeCents: number;
  status: HqsInspectionStatus;
  checkoutUrl: string | null;
  paidAt: string | null;
  preferredDateNote: string | null;
  requestedAt: string | null;
  emailSent: boolean;
  createdAt: string;
}

export type TenantPacketStatus = 'NOT_STARTED' | 'AWAITING_PAYMENT' | 'PAID' | 'SUBMITTED';

export interface TenantPacketReferenceContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
}

export interface TenantPacketSummary {
  id: string | null;
  feeCents: number;
  status: TenantPacketStatus;
  checkoutUrl: string | null;
  paidAt: string | null;
  incomeProofFileName: string | null;
  backgroundExplanation: string | null;
  references: string | null;
  monthlyIncomeCents: number | null;
  employerName: string | null;
  referenceContacts: TenantPacketReferenceContact[];
  submittedAt: string | null;
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
  listProperties: (accessToken: string, filters: PropertySearchFilters & { type?: string } = {}) => {
    const params = searchFiltersToParams(filters);
    if (filters.type) params.set('type', filters.type);
    const qs = params.toString();
    return request<PropertySummary[]>(`/properties${qs ? `?${qs}` : ''}`, {}, accessToken);
  },
  getProperty: (accessToken: string, id: string) => request<PropertySummary>(`/properties/${id}`, {}, accessToken),
  // Public — no accessToken needed, same reasoning as getPropertyFeed: a
  // logged-out visitor browsing Section 8, second-chance, or room-rental
  // listings gets a capped, real preview instead of a login wall.
  getPropertyPreview: (filters: PropertySearchFilters = {}) => {
    const qs = searchFiltersToParams(filters).toString();
    return request<{ total: number; properties: PropertySummary[] }>(`/properties/preview${qs ? `?${qs}` : ''}`);
  },
  // Public — no accessToken needed. The home page feed and its view-count
  // ping are a logged-out visitor's first touch with the platform.
  getPropertyFeed: (take = 12) => request<PropertySummary[]>(`/properties/feed?take=${take}`),
  recordPropertyView: (id: string) => request<void>(`/properties/${id}/view`, { method: 'POST' }),
  createProperty: (accessToken: string, payload: CreatePropertyPayload) =>
    request<PropertySummary>('/properties', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  updateProperty: (accessToken: string, id: string, payload: UpdatePropertyPayload) =>
    request<PropertySummary>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, accessToken),
  purchaseBoost: (accessToken: string, id: string) =>
    request<PropertySummary>(`/properties/${id}/boost`, { method: 'POST' }, accessToken),
  createUnit: (accessToken: string, propertyId: string, payload: CreateUnitPayload) =>
    request<UnitSummary>(`/properties/${propertyId}/units`, { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  updateUnit: (accessToken: string, propertyId: string, unitId: string, payload: Partial<CreateUnitPayload>) =>
    request<UnitSummary>(
      `/properties/${propertyId}/units/${unitId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      accessToken,
    ),
  createBed: (accessToken: string, propertyId: string, unitId: string, payload: CreateBedPayload) =>
    request<BedSummary>(
      `/properties/${propertyId}/units/${unitId}/beds`,
      { method: 'POST', body: JSON.stringify(payload) },
      accessToken,
    ),
  updateBed: (accessToken: string, propertyId: string, unitId: string, bedId: string, payload: Partial<CreateBedPayload>) =>
    request<BedSummary>(
      `/properties/${propertyId}/units/${unitId}/beds/${bedId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      accessToken,
    ),
  listNearbySchools: (accessToken: string, propertyId: string) =>
    request<NearbySchool[]>(`/properties/${propertyId}/schools`, {}, accessToken),
  refreshNearbySchools: (accessToken: string, propertyId: string) =>
    request<NearbySchool[]>(`/properties/${propertyId}/schools/refresh`, { method: 'POST' }, accessToken),
  listAgencies: (accessToken: string) => request<AgencySummary[]>('/properties/agencies', {}, accessToken),
  getSubscription: (accessToken: string) => request<Subscription>('/subscriptions/me', {}, accessToken),
  createSubscriptionCheckout: (accessToken: string, tier: 'PRO' | 'UNLIMITED') =>
    request<Subscription>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ tier }) }, accessToken),
  getRentEstimate: (
    accessToken: string,
    params: { addressLine1: string; city: string; state: string; zip: string; bedrooms?: number },
  ) => {
    const qs = new URLSearchParams();
    qs.set('addressLine1', params.addressLine1);
    qs.set('city', params.city);
    qs.set('state', params.state);
    qs.set('zip', params.zip);
    if (params.bedrooms !== undefined) qs.set('bedrooms', String(params.bedrooms));
    return request<RentEstimate>(`/properties/rent-estimate?${qs.toString()}`, {}, accessToken);
  },
  // Public — no accessToken needed, same reasoning as getPropertyFeed: a
  // voucher holder racing an expiration deadline shouldn't need an account.
  getVoucherMatches: (zip: string, bedrooms: number) =>
    request<VoucherMatch>(`/properties/voucher-matcher?zip=${encodeURIComponent(zip)}&bedrooms=${bedrooms}`),
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
  startConversation: (
    accessToken: string,
    payload: { propertyId: string; unitId?: string; bedId?: string; message: string },
  ) => request<StartConversationResult>('/conversations', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
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
  listIdSubmissions: (accessToken: string, conversationId: string) =>
    request<IdSubmissionSummary[]>(`/conversations/${conversationId}/id-submissions`, {}, accessToken),
  createIdSubmission: (accessToken: string, conversationId: string) =>
    request<IdSubmissionSummary>(
      `/conversations/${conversationId}/id-submissions`,
      { method: 'POST', body: JSON.stringify({}) },
      accessToken,
    ),
  cancelIdSubmission: (accessToken: string, id: string) =>
    request<IdSubmissionSummary>(`/id-submissions/${id}/cancel`, { method: 'PATCH' }, accessToken),
  submitIdSubmission: (accessToken: string, id: string, file: File, note?: string) => {
    const formData = new FormData();
    if (note) formData.set('note', note);
    formData.set('file', file);
    return requestMultipart<IdSubmissionSummary>(`/id-submissions/${id}/submit`, formData, accessToken);
  },
  listHqsInspections: (accessToken: string, propertyId: string) =>
    request<HqsInspectionSummary[]>(`/properties/${propertyId}/hqs-inspections`, {}, accessToken),
  createHqsInspection: (accessToken: string, propertyId: string) =>
    request<HqsInspectionSummary>(`/properties/${propertyId}/hqs-inspections`, { method: 'POST' }, accessToken),
  cancelHqsInspection: (accessToken: string, id: string) =>
    request<HqsInspectionSummary>(`/hqs-inspections/${id}/cancel`, { method: 'PATCH' }, accessToken),
  requestHqsInspection: (accessToken: string, id: string, preferredDateNote?: string) =>
    request<HqsInspectionSummary>(
      `/hqs-inspections/${id}/request`,
      { method: 'POST', body: JSON.stringify({ preferredDateNote }) },
      accessToken,
    ),
  getTenantPacket: (accessToken: string) => request<TenantPacketSummary>('/tenant-packet/me', {}, accessToken),
  createTenantPacketCheckout: (accessToken: string) =>
    request<TenantPacketSummary>('/tenant-packet/checkout', { method: 'POST' }, accessToken),
  submitTenantPacket: (
    accessToken: string,
    payload: {
      backgroundExplanation?: string;
      references?: string;
      monthlyIncomeCents?: number;
      employerName?: string;
      referenceContacts?: { name: string; phone?: string; email?: string; relationship?: string }[];
      file?: File;
    },
  ) => {
    const formData = new FormData();
    if (payload.backgroundExplanation) formData.set('backgroundExplanation', payload.backgroundExplanation);
    if (payload.references) formData.set('references', payload.references);
    if (payload.monthlyIncomeCents !== undefined) formData.set('monthlyIncomeCents', String(payload.monthlyIncomeCents));
    if (payload.employerName) formData.set('employerName', payload.employerName);
    if (payload.referenceContacts) formData.set('referenceContacts', JSON.stringify(payload.referenceContacts));
    if (payload.file) formData.set('file', payload.file);
    return requestMultipart<TenantPacketSummary>('/tenant-packet/submit', formData, accessToken);
  },
  shareTenantPacket: (accessToken: string, conversationId: string) =>
    request<{ emailed: boolean }>(`/conversations/${conversationId}/tenant-packet/share`, { method: 'POST' }, accessToken),
  /** Dev/test only — stands in for the real payment processor calling our webhook after a completed charge. */
  simulateMockPayment: (providerOrderId: string) =>
    request<{ status: string }>('/payments/webhooks', {
      method: 'POST',
      body: JSON.stringify({ providerOrderId, paid: true }),
    }),
  listGigJobs: (accessToken: string) => request<GigJob[]>('/gig-jobs', {}, accessToken),
  listPostedGigJobs: (accessToken: string) => request<GigJob[]>('/gig-jobs/posted', {}, accessToken),
  createGigJob: (accessToken: string, payload: { title: string; description: string; payoutCents: number; propertyId?: string }) =>
    request<GigJob>('/gig-jobs', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  claimGigJob: (accessToken: string, id: string, conversationId: string) =>
    request<GigJob>(`/gig-jobs/${id}/claim`, { method: 'PATCH', body: JSON.stringify({ conversationId }) }, accessToken),
  completeGigJob: (accessToken: string, id: string) =>
    request<GigJob>(`/gig-jobs/${id}/complete`, { method: 'PATCH' }, accessToken),
  rejectGigJobCompletion: (accessToken: string, id: string) =>
    request<GigJob>(`/gig-jobs/${id}/reject-completion`, { method: 'PATCH' }, accessToken),
  cancelGigJob: (accessToken: string, id: string) =>
    request<GigJob>(`/gig-jobs/${id}/cancel`, { method: 'PATCH' }, accessToken),
  payGigJob: (accessToken: string, id: string) =>
    request<GigJob>(`/gig-jobs/${id}/pay`, { method: 'POST' }, accessToken),
  listMyGigVouchers: (accessToken: string) => request<GigVoucher[]>('/gig-vouchers/me', {}, accessToken),
  listIssuedGigVouchers: (accessToken: string) => request<GigVoucher[]>('/gig-vouchers/issued', {}, accessToken),
  applyGigVoucher: (accessToken: string, id: string, note?: string) =>
    request<GigVoucher>(`/gig-vouchers/${id}/apply`, { method: 'PATCH', body: JSON.stringify({ note }) }, accessToken),
  listJobReferrals: (accessToken: string) => request<JobReferral[]>('/job-referrals', {}, accessToken),
  listPostedJobReferrals: (accessToken: string) => request<JobReferral[]>('/job-referrals/posted', {}, accessToken),
  createJobReferral: (
    accessToken: string,
    payload: { title: string; employerName: string; location: string; applyUrl?: string; contactInfo?: string; description?: string },
  ) => request<JobReferral>('/job-referrals', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  closeJobReferral: (accessToken: string, id: string) =>
    request<JobReferral>(`/job-referrals/${id}/close`, { method: 'PATCH' }, accessToken),
  createSponsoredJobListing: (
    accessToken: string,
    payload: {
      title: string;
      employerName: string;
      location: string;
      applyUrl: string;
      contactInfo?: string;
      description?: string;
      costPerClickCents: number;
      monthlyFeeCents: number;
      initialBudgetCents: number;
    },
  ) => request<JobReferral>('/job-referrals/sponsored', { method: 'POST', body: JSON.stringify(payload) }, accessToken),
  topUpJobListing: (accessToken: string, id: string, additionalBudgetCents: number) =>
    request<JobReferral>(`/job-referrals/${id}/topup`, { method: 'POST', body: JSON.stringify({ additionalBudgetCents }) }, accessToken),
  renewJobListing: (accessToken: string, id: string) =>
    request<JobReferral>(`/job-referrals/${id}/renew`, { method: 'POST' }, accessToken),
  clickJobReferral: (accessToken: string, id: string) =>
    request<{ applyUrl: string }>(`/job-referrals/${id}/click`, { method: 'POST' }, accessToken),
};
