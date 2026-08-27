'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ConversationSummary, IdSubmissionSummary, MessageSummary, ShowingSummary } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { useConversationSocket } from '../../../lib/use-conversation-socket';
import { formatDateTime } from '../../../lib/format';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';
import { ShowingPanel } from '../../../components/ShowingPanel';
import { IdSubmissionPanel } from '../../../components/IdSubmissionPanel';

// Real-time updates arrive over the WebSocket (see useConversationSocket);
// this is just a low-frequency safety net in case a socket silently drops.
const FALLBACK_POLL_INTERVAL_MS = 30_000;

export default function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, isLoading: authLoading } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [showing, setShowing] = useState<ShowingSummary | null>(null);
  const [idSubmission, setIdSubmission] = useState<IdSubmissionSummary | null>(null);
  const [packetShareBusy, setPacketShareBusy] = useState(false);
  const [packetShareError, setPacketShareError] = useState<string | null>(null);
  const [packetShared, setPacketShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const [conv, msgs, showings, idSubmissions] = await Promise.all([
      api.getConversation(accessToken, id),
      api.listMessages(accessToken, id),
      api.listShowings(accessToken, id),
      api.listIdSubmissions(accessToken, id),
    ]);
    setConversation(conv);
    setMessages(msgs);
    setShowing(showings[0] ?? null);
    setIdSubmission(idSubmissions.find((s) => s.status !== 'CANCELLED') ?? null);
  }, [accessToken, id]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversation'))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      refresh().catch(() => undefined);
    }, FALLBACK_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [accessToken, authLoading, refresh, router]);

  useConversationSocket(
    id,
    accessToken,
    (incoming) => {
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
    },
    (patch) => {
      setConversation((prev) => (prev && prev.id === patch.id ? { ...prev, status: patch.status } : prev));
    },
    (updatedShowing) => setShowing(updatedShowing),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleProposeShowing(startTimeIso: string) {
    if (!accessToken) return;
    const updated = await api.proposeShowing(accessToken, id, startTimeIso);
    setShowing(updated);
  }

  async function handleAcceptSlot(showingId: string, slotId: string) {
    if (!accessToken) return;
    const updated = await api.acceptShowingSlot(accessToken, id, showingId, slotId);
    setShowing(updated);
  }

  async function handleCancelShowing(showingId: string) {
    if (!accessToken) return;
    const updated = await api.cancelShowing(accessToken, id, showingId);
    setShowing(updated);
  }

  async function handleStartIdSubmission() {
    if (!accessToken) return;
    const created = await api.createIdSubmission(accessToken, id);
    setIdSubmission(created);
  }

  async function handleCancelIdSubmission(submissionId: string) {
    if (!accessToken) return;
    const updated = await api.cancelIdSubmission(accessToken, submissionId);
    setIdSubmission(updated.status === 'CANCELLED' ? null : updated);
  }

  async function handleSubmitId(submissionId: string, file: File, note?: string) {
    if (!accessToken) return;
    const updated = await api.submitIdSubmission(accessToken, submissionId, file, note);
    setIdSubmission(updated);
  }

  async function handleShareTenantPacket() {
    if (!accessToken) return;
    setPacketShareBusy(true);
    setPacketShareError(null);
    try {
      await api.shareTenantPacket(accessToken, id);
      setPacketShared(true);
    } catch (err) {
      setPacketShareError(err instanceof Error ? err.message : 'Failed to share your Fast-Track packet');
    } finally {
      setPacketShareBusy(false);
    }
  }

  async function submitReply() {
    if (!accessToken || reply.trim().length === 0) return;
    setSending(true);
    setGuidance(null);
    try {
      const result = await api.sendMessage(accessToken, id, reply);
      if (result.delivered) {
        setReply('');
      } else {
        setGuidance(result.guidance ?? 'Your message was not delivered. Please edit and try again.');
      }
      await refresh();
    } catch (err) {
      setGuidance(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (error || !conversation) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24, color: theme.danger }}>{error ?? 'Conversation not found'}</p>
      </main>
    );
  }

  const isTenantView = user?.role === 'PROSPECTIVE_TENANT' || user?.role === 'CURRENT_TENANT';

  return (
    <main style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ maxWidth: 700, width: '100%', margin: '0 auto', padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Link href="/inbox" style={{ color: theme.primary, fontSize: 14, textDecoration: 'none' }}>
          ← Back to inbox
        </Link>

        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>{conversation.property.title}</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, margin: '2px 0' }}>
            {conversation.property.addressLine1}, {conversation.property.city}, {conversation.property.state}
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {isTenantView ? conversation.landlordDisplayName : conversation.tenantDisplayName}
            {conversation.relayPhoneNumber && (
              <span style={{ color: theme.textMuted }}> · relayed via {conversation.relayPhoneNumber}</span>
            )}
          </p>
        </div>

        <div
          style={{
            flex: 1,
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 300,
            maxHeight: 500,
            overflowY: 'auto',
          }}
        >
          {messages.length === 0 && <p style={{ color: theme.textMuted }}>No messages yet.</p>}
          {messages.map((m) => {
            const isMine = m.senderId === user?.id;
            const isBlocked = m.status === 'BLOCKED';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: isBlocked ? theme.warningBg : isMine ? theme.primary : '#eef1f5',
                    color: isBlocked ? theme.warningText : isMine ? 'white' : theme.text,
                    fontSize: 14,
                  }}
                >
                  {isBlocked && (
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      NOT DELIVERED — contains restricted content
                    </div>
                  )}
                  <div>{m.content}</div>
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      opacity: 0.8,
                      color: isBlocked ? theme.warningText : isMine ? 'white' : theme.textMuted,
                    }}
                  >
                    {m.senderDisplayName} · {formatDateTime(m.createdAt)}
                    {m.channel === 'SMS' ? ' · via SMS' : ''}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <ShowingPanel
          showing={showing}
          currentUserId={user?.id}
          onPropose={handleProposeShowing}
          onAcceptSlot={handleAcceptSlot}
          onCancel={handleCancelShowing}
        />

        <IdSubmissionPanel
          submission={idSubmission}
          isTenantView={isTenantView}
          onStart={handleStartIdSubmission}
          onCancel={handleCancelIdSubmission}
          onSubmit={handleSubmitId}
        />

        {isTenantView && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>Fast-Track profile packet</strong>
              <button
                onClick={handleShareTenantPacket}
                disabled={packetShareBusy}
                style={{ border: 'none', background: theme.primary, color: 'white', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                {packetShareBusy ? 'Sharing...' : packetShared ? 'Shared ✓' : 'Share with this landlord'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>
              Sends your income proof, background explanation, and references from{' '}
              <Link href="/tenant-packet" style={{ color: theme.primary, fontWeight: 600 }}>
                your Fast-Track packet
              </Link>{' '}
              directly to this landlord.
            </p>
            {packetShareError && <p style={{ color: theme.danger, fontSize: 12, marginTop: 6, marginBottom: 0 }}>{packetShareError}</p>}
          </div>
        )}

        {guidance && (
          <p style={{ background: theme.warningBg, color: theme.warningText, padding: 10, borderRadius: 8, fontSize: 13, marginTop: 12 }}>
            {guidance}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 24 }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message..."
            rows={2}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 14, fontFamily: 'inherit' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitReply();
              }
            }}
          />
          <button
            onClick={submitReply}
            disabled={sending || reply.trim().length === 0}
            style={{
              padding: '0 20px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
