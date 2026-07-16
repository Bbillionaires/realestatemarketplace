# Architecture

## System overview

```mermaid
flowchart TB
    subgraph Clients
        TenantPhone["Tenant's phone (native SMS app)"]
        LandlordPhone["Landlord's phone (native SMS app)"]
        Dashboard["Next.js Dashboard\n(tenant / landlord / admin)"]
    end

    subgraph Carrier["SMS Carrier"]
        Twilio["Twilio / Telnyx"]
    end

    subgraph Platform["NestJS API"]
        WebhookIn["Inbound SMS Webhook"]
        WebhookStatus["Delivery Status Webhook"]
        REST["REST API\n(auth, properties, conversations, ...)"]
        Moderation["Moderation Engine\n(regex + normalization + AI fallback)"]
        Routing["Conversation / Relay Router"]
        Queues["BullMQ Queues\n(moderation, outbound SMS, reminders, retries)"]
    end

    subgraph Data
        Postgres[("PostgreSQL\nvia Prisma")]
        Redis[("Redis\nrouting cache, rate limits, queues")]
    end

    TenantPhone <-- SMS --> Twilio
    LandlordPhone <-- SMS --> Twilio
    Twilio -- inbound webhook --> WebhookIn
    Twilio -- status webhook --> WebhookStatus
    Dashboard <-- HTTPS/REST --> REST

    WebhookIn --> Routing
    Routing --> Moderation
    Moderation -- approved --> Queues
    Queues -- outbound send --> Twilio
    WebhookStatus --> Queues
    REST --> Postgres
    REST --> Redis
    Queues --> Postgres
    Routing --> Postgres
    Moderation --> Postgres
    Queues <--> Redis
```

## Module boundaries (NestJS)

Each domain is an independent Nest module with its own controller/service/DTOs. Cross-cutting
concerns (auth, RBAC, audit logging, phone encryption) live in `common/`, `audit/`, and are
registered as global providers so every module gets them without explicit imports.

```mermaid
flowchart LR
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> PhoneModule
    AppModule --> PropertiesModule
    AppModule --> ConversationsModule["ConversationsModule (Phase 2)"]
    AppModule --> MessagesModule["MessagesModule (Phase 2)"]
    AppModule --> SmsModule
    AppModule --> ModerationModule["ModerationModule (Phase 3)"]
    AppModule --> SchedulingModule["SchedulingModule (Phase 4)"]
    AppModule --> AdminModule["AdminModule (Phase 5)"]
    AppModule --> AuditModule
    AppModule --> CommonModule
    SmsModule -.implements.-> SmsProviderInterface["SmsProvider interface"]
    SmsProviderInterface --> MockProvider
    SmsProviderInterface --> TwilioProvider["TwilioProvider (Phase 2)"]
    SmsProviderInterface --> TelnyxProvider["TelnyxProvider (future)"]
```

## SMS provider abstraction

```typescript
interface SmsProvider {
  sendMessage(input: SendSmsInput): Promise<SendSmsResult>;
  validateWebhook(input: ValidateWebhookInput): boolean;
  parseInboundMessage(input: unknown): ParsedInboundMessage;
  parseDeliveryStatus(input: unknown): ParsedDeliveryStatus;
}
```

`SmsModule` binds a single DI token (`SMS_PROVIDER`) to whichever concrete implementation is
selected by the `SMS_PROVIDER` env var. Nothing else in the codebase imports Twilio or Telnyx
directly — conversation routing, delivery tracking, and moderation only ever talk to the
interface. `MockSmsProvider` (Phase 1) implements it entirely in memory for local dev/tests;
`TwilioProvider`/`TelnyxProvider` land in Phase 2 without touching any caller.

## Phone-number privacy model

1. Real phone numbers are only ever written to `PhoneNumber.encryptedNumber`, an AES-256-GCM
   ciphertext keyed by `PHONE_ENCRYPTION_KEY` (32-byte key, env-provided, never in source).
2. `PhoneNumber.numberHash` is an HMAC-SHA256 (keyed by a *separate* `PHONE_HASH_SECRET`) used
   purely for equality lookups — it cannot be reversed to the original number, and a leak of the
   hash key alone does not compromise the encryption key.
3. Every response DTO (`UserResponseDto`, `PhoneNumberResponseDto`, `PropertyResponseDto`, ...) is
   an explicit allow-list class with a `static from(...)` constructor — there is no code path that
   serializes a raw Prisma row, so a schema change can't accidentally leak a new sensitive field.
4. Dashboards only ever receive a masked number (`(***) ***-1234`) computed server-side from
   `last4`; the full number is decrypted only inside the SMS-send code path.
5. In Phase 2, landlord and tenant SMS traffic is relayed entirely through pooled `RelayNumber`s —
   neither party's device ever sees the other's number in their native messaging app.

## Database relationship diagram

```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o{ PhoneNumber : owns
    PhoneNumber ||--o{ PhoneVerification : has
    User ||--o{ RefreshToken : has
    User ||--o{ Property : owns
    Property ||--o{ PropertyUnit : has
    Property ||--o{ PropertyManagerAssignment : has
    User ||--o{ PropertyManagerAssignment : "is manager in"

    Property ||--o{ Conversation : "is subject of"
    PropertyUnit ||--o{ Conversation : "is subject of"
    User ||--o{ Conversation : "tenant in"
    User ||--o{ Conversation : "landlord in"
    Conversation ||--o{ ConversationParticipant : has
    Conversation ||--o{ Message : contains
    Conversation ||--o{ RelayAssignment : uses
    RelayNumber ||--o{ RelayAssignment : "assigned to"

    Message ||--o{ MessageDelivery : "has status events"
    Message ||--o{ MessageAttachment : has
    Message ||--o{ ModerationFlag : "may raise"
    Message ||--o{ Violation : "may cause"

    Conversation ||--o{ Showing : has
    Showing ||--o{ ShowingTimeSlot : has
    Conversation ||--o{ Application : has
    Conversation ||--o{ Lease : has
    Lease ||--o{ ContactRelease : enables
    Conversation ||--o{ ContactRelease : has

    User ||--o{ Violation : commits
    User ||--o{ UserRestriction : "may be restricted"
    User ||--o| NotificationPreference : has
    User ||--o{ ConsentEvent : has
    User ||--o{ AuditLog : "acted as"
    Conversation ||--o{ AdminNote : has
```
