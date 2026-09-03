'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api,
  ApplicationOccupant,
  ApplicationReference,
  ApplicationRentalHistoryEntry,
  ApplicationSummary,
} from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useCurrentUser } from '../../../../lib/use-current-user';
import { formatDateTime } from '../../../../lib/format';
import { theme } from '../../../../lib/theme';
import { NavBar } from '../../../../components/NavBar';

const TENANT_ROLES = ['PROSPECTIVE_TENANT', 'CURRENT_TENANT'];

const STATUS_LABEL: Record<string, string> = {
  STARTED: 'Draft — not yet submitted',
  SUBMITTED: 'Submitted — awaiting review',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  WITHDRAWN: 'Withdrawn',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: 8,
  borderRadius: 8,
  border: `1px solid ${theme.border}`,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};
const labelStyle = { fontSize: 12, color: theme.textMuted, fontWeight: 600 };
const sectionStyle = {
  background: theme.card,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radius,
  boxShadow: theme.shadow,
  padding: 20,
  marginBottom: 16,
};

type FormState = {
  fullLegalName: string;
  dateOfBirth: string;
  contactPhone: string;
  contactEmail: string;
  currentAddressLine1: string;
  currentAddressLine2: string;
  currentCity: string;
  currentState: string;
  currentZip: string;
  employerName: string;
  employerPhone: string;
  position: string;
  employmentStartDate: string;
  monthlyIncomeCents: string;
  otherIncomeCents: string;
  otherIncomeNote: string;
  reasonForMoving: string;
  hasPets: boolean;
  petDetails: string;
  hasVehicles: boolean;
  vehicleDetails: string;
  hasGuarantor: boolean;
  guarantorFullName: string;
  guarantorPhone: string;
  guarantorEmail: string;
  guarantorMonthlyIncomeCents: string;
};

function toFormState(a: ApplicationSummary | null): FormState {
  return {
    fullLegalName: a?.fullLegalName ?? '',
    dateOfBirth: a?.dateOfBirth ?? '',
    contactPhone: a?.contactPhone ?? '',
    contactEmail: a?.contactEmail ?? '',
    currentAddressLine1: a?.currentAddressLine1 ?? '',
    currentAddressLine2: a?.currentAddressLine2 ?? '',
    currentCity: a?.currentCity ?? '',
    currentState: a?.currentState ?? '',
    currentZip: a?.currentZip ?? '',
    employerName: a?.employerName ?? '',
    employerPhone: a?.employerPhone ?? '',
    position: a?.position ?? '',
    employmentStartDate: a?.employmentStartDate ?? '',
    monthlyIncomeCents: a?.monthlyIncomeCents != null ? (a.monthlyIncomeCents / 100).toString() : '',
    otherIncomeCents: a?.otherIncomeCents != null ? (a.otherIncomeCents / 100).toString() : '',
    otherIncomeNote: a?.otherIncomeNote ?? '',
    reasonForMoving: a?.reasonForMoving ?? '',
    hasPets: a?.hasPets ?? false,
    petDetails: a?.petDetails ?? '',
    hasVehicles: a?.hasVehicles ?? false,
    vehicleDetails: a?.vehicleDetails ?? '',
    hasGuarantor: a?.hasGuarantor ?? false,
    guarantorFullName: a?.guarantorFullName ?? '',
    guarantorPhone: a?.guarantorPhone ?? '',
    guarantorEmail: a?.guarantorEmail ?? '',
    guarantorMonthlyIncomeCents: a?.guarantorMonthlyIncomeCents != null ? (a.guarantorMonthlyIncomeCents / 100).toString() : '',
  };
}

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, isLoading } = useAuth();
  const { user } = useCurrentUser();
  const router = useRouter();

  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [occupants, setOccupants] = useState<{ name: string; relationship: string }[]>([]);
  const [rentalHistory, setRentalHistory] = useState<Partial<ApplicationRentalHistoryEntry>[]>([]);
  const [references, setReferences] = useState<{ name: string; relationship: string; phone: string; email: string }[]>([]);
  const [incomeProofFile, setIncomeProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  const isTenantView = !!user && TENANT_ROLES.includes(user.role);

  function loadInto(a: ApplicationSummary) {
    setApplication(a);
    setForm(toFormState(a));
    setOccupants(a.occupants.map((o) => ({ name: o.name, relationship: o.relationship ?? '' })));
    setRentalHistory(a.rentalHistory);
    setReferences(a.references.map((r) => ({ name: r.name, relationship: r.relationship ?? '', phone: r.phone ?? '', email: r.email ?? '' })));
  }

  useEffect(() => {
    if (isLoading || !user) return;
    if (!accessToken) {
      router.push('/login');
      return;
    }
    const load = isTenantView ? api.createApplication(accessToken, id) : api.getApplication(accessToken, id);
    load
      .then(loadInto)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load application'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isLoading, user, id]);

  const canEdit = isTenantView && (application?.status === 'STARTED' || application?.status === 'WITHDRAWN' || application?.status === 'DENIED');

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateApplication(accessToken, id, {
        fullLegalName: form.fullLegalName || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        currentAddressLine1: form.currentAddressLine1 || undefined,
        currentAddressLine2: form.currentAddressLine2 || undefined,
        currentCity: form.currentCity || undefined,
        currentState: form.currentState || undefined,
        currentZip: form.currentZip || undefined,
        employerName: form.employerName || undefined,
        employerPhone: form.employerPhone || undefined,
        position: form.position || undefined,
        employmentStartDate: form.employmentStartDate || undefined,
        monthlyIncomeCents: form.monthlyIncomeCents ? Math.round(Number(form.monthlyIncomeCents) * 100) : undefined,
        otherIncomeCents: form.otherIncomeCents ? Math.round(Number(form.otherIncomeCents) * 100) : undefined,
        otherIncomeNote: form.otherIncomeNote || undefined,
        reasonForMoving: form.reasonForMoving || undefined,
        hasPets: form.hasPets,
        petDetails: form.petDetails || undefined,
        hasVehicles: form.hasVehicles,
        vehicleDetails: form.vehicleDetails || undefined,
        hasGuarantor: form.hasGuarantor,
        guarantorFullName: form.guarantorFullName || undefined,
        guarantorPhone: form.guarantorPhone || undefined,
        guarantorEmail: form.guarantorEmail || undefined,
        guarantorMonthlyIncomeCents: form.guarantorMonthlyIncomeCents
          ? Math.round(Number(form.guarantorMonthlyIncomeCents) * 100)
          : undefined,
        occupants: occupants.filter((o) => o.name.trim()),
        rentalHistory: rentalHistory
          .filter((r) => r.addressLine1?.trim())
          .map((r) => ({
            addressLine1: r.addressLine1!,
            city: r.city ?? undefined,
            state: r.state ?? undefined,
            zip: r.zip ?? undefined,
            landlordName: r.landlordName ?? undefined,
            landlordPhone: r.landlordPhone ?? undefined,
            landlordEmail: r.landlordEmail ?? undefined,
            monthlyRentCents: r.monthlyRentCents ?? undefined,
            moveInDate: r.moveInDate ?? undefined,
            moveOutDate: r.moveOutDate ?? undefined,
            reasonForLeaving: r.reasonForLeaving ?? undefined,
          })),
        references: references.filter((r) => r.name.trim()),
        incomeProofFile: incomeProofFile ?? undefined,
      });
      loadInto(updated);
      setIncomeProofFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save application');
    } finally {
      setBusy(false);
    }
  }

  async function onPay() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.payApplicationFee(accessToken, id);
      if (updated.checkoutUrl) {
        window.location.href = updated.checkoutUrl;
      } else {
        loadInto(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      loadInto(await api.submitApplication(accessToken, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      loadInto(await api.withdrawApplication(accessToken, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw application');
    } finally {
      setBusy(false);
    }
  }

  async function onMarkUnderReview() {
    if (!accessToken || !application?.id) return;
    setBusy(true);
    setError(null);
    try {
      loadInto(await api.markApplicationUnderReview(accessToken, application.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(decision: 'APPROVED' | 'DENIED') {
    if (!accessToken || !application?.id) return;
    setBusy(true);
    setError(null);
    try {
      loadInto(await api.decideApplication(accessToken, application.id, decision, decisionNotes || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record decision');
    } finally {
      setBusy(false);
    }
  }

  function onDownloadIncomeProof() {
    if (!accessToken) return;
    api.downloadApplicationIncomeProof(accessToken, id).catch((err) => setError(err instanceof Error ? err.message : 'Failed to download'));
  }

  const needsPayment = !!application?.feeCents && !application.paidAt;

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>Rental Application</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Background/credit/eviction screening and ID verification are handled separately — see{' '}
          <Link href="/tenant-screening" style={{ color: theme.primary, fontWeight: 600 }}>
            Tenant Screening
          </Link>{' '}
          and the ID submission panel on this conversation. This form never asks for your Social Security Number.
        </p>

        {loading && <p style={{ color: theme.textMuted }}>Loading...</p>}
        {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

        {!loading && application && (
          <div style={sectionStyle}>
            <strong style={{ fontSize: 14 }}>Status: {STATUS_LABEL[application.status ?? 'STARTED']}</strong>
            {application.submittedAt && (
              <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>Submitted {formatDateTime(application.submittedAt)}</p>
            )}
            {application.decisionAt && (
              <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>Decision recorded {formatDateTime(application.decisionAt)}</p>
            )}
            {application.notes && (
              <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>Notes: {application.notes}</p>
            )}

            {isTenantView && needsPayment && application.status === 'STARTED' && (
              <button
                onClick={onPay}
                disabled={busy}
                style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Pay application fee (${((application.feeCents ?? 0) / 100).toFixed(2)})
              </button>
            )}
            {isTenantView && application.status === 'STARTED' && !needsPayment && (
              <button
                onClick={onSubmit}
                disabled={busy}
                style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Submit application
              </button>
            )}
            {isTenantView && (application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW') && (
              <button
                onClick={onWithdraw}
                disabled={busy}
                style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.danger}`, color: theme.danger, background: 'white', fontSize: 13, cursor: 'pointer' }}
              >
                Withdraw application
              </button>
            )}
            {!isTenantView && application.status === 'SUBMITTED' && (
              <button
                onClick={onMarkUnderReview}
                disabled={busy}
                style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: 'white', fontSize: 13, cursor: 'pointer' }}
              >
                Mark under review
              </button>
            )}
            {!isTenantView && (application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW') && (
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Decision notes (optional)"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: `1px solid ${theme.border}`, fontSize: 13 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onDecide('APPROVED')} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onDecide('DENIED')} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${theme.danger}`, color: theme.danger, background: 'white', fontSize: 13, cursor: 'pointer' }}>
                    Deny
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && application && (
          <form onSubmit={onSave}>
            <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Identity</h2>
                <label style={labelStyle}>Full legal name<input style={inputStyle} value={form.fullLegalName} onChange={(e) => setForm({ ...form, fullLegalName: e.target.value })} /></label>
                <label style={labelStyle}>Date of birth<input type="date" style={inputStyle} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
                <label style={labelStyle}>Phone<input style={inputStyle} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                <label style={labelStyle}>Email<input type="email" style={inputStyle} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                <label style={labelStyle}>Current address<input style={inputStyle} placeholder="Address line 1" value={form.currentAddressLine1} onChange={(e) => setForm({ ...form, currentAddressLine1: e.target.value })} /></label>
                <input style={{ ...inputStyle, marginTop: 6 }} placeholder="Address line 2 (optional)" value={form.currentAddressLine2} onChange={(e) => setForm({ ...form, currentAddressLine2: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input style={inputStyle} placeholder="City" value={form.currentCity} onChange={(e) => setForm({ ...form, currentCity: e.target.value })} />
                  <input style={inputStyle} placeholder="State" value={form.currentState} onChange={(e) => setForm({ ...form, currentState: e.target.value })} />
                  <input style={inputStyle} placeholder="ZIP" value={form.currentZip} onChange={(e) => setForm({ ...form, currentZip: e.target.value })} />
                </div>
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Household</h2>
                <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0 }}>Other adults/occupants who will live in the unit.</p>
                {occupants.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input style={inputStyle} placeholder="Name" value={o.name} onChange={(e) => setOccupants(occupants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input style={inputStyle} placeholder="Relationship" value={o.relationship} onChange={(e) => setOccupants(occupants.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))} />
                    {canEdit && (
                      <button type="button" onClick={() => setOccupants(occupants.filter((_, j) => j !== i))} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', color: theme.danger, fontSize: 12, cursor: 'pointer' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button type="button" onClick={() => setOccupants([...occupants, { name: '', relationship: '' }])} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${theme.primary}`, background: 'white', color: theme.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    + Add occupant
                  </button>
                )}
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Employment & Income</h2>
                <label style={labelStyle}>Employer<input style={inputStyle} value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} /></label>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <label style={{ ...labelStyle, flex: 1 }}>Position<input style={inputStyle} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
                  <label style={{ ...labelStyle, flex: 1 }}>Employer phone<input style={inputStyle} value={form.employerPhone} onChange={(e) => setForm({ ...form, employerPhone: e.target.value })} /></label>
                </div>
                <label style={labelStyle}>Employment start date<input type="date" style={inputStyle} value={form.employmentStartDate} onChange={(e) => setForm({ ...form, employmentStartDate: e.target.value })} /></label>
                <label style={labelStyle}>Gross monthly income ($)<input type="number" min={0} style={inputStyle} value={form.monthlyIncomeCents} onChange={(e) => setForm({ ...form, monthlyIncomeCents: e.target.value })} /></label>
                <label style={labelStyle}>Other income ($, optional)<input type="number" min={0} style={inputStyle} value={form.otherIncomeCents} onChange={(e) => setForm({ ...form, otherIncomeCents: e.target.value })} /></label>
                <label style={labelStyle}>Other income source (e.g. self-employed 1099, bank statements)<input style={inputStyle} value={form.otherIncomeNote} onChange={(e) => setForm({ ...form, otherIncomeNote: e.target.value })} /></label>
                <label style={labelStyle}>
                  Proof of income {application.incomeProofFileName ? `(currently: ${application.incomeProofFileName})` : ''}
                  {application.incomeProofFileName && (
                    <button type="button" onClick={onDownloadIncomeProof} style={{ marginLeft: 8, fontSize: 11, border: 'none', background: 'none', color: theme.primary, cursor: 'pointer' }}>
                      View
                    </button>
                  )}
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setIncomeProofFile(e.target.files?.[0] ?? null)} style={{ display: 'block', marginTop: 6, fontSize: 13 }} />
                </label>
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Rental History</h2>
                {rentalHistory.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, padding: 10, border: `1px solid ${theme.border}`, borderRadius: 8, marginBottom: 8 }}>
                    <input style={inputStyle} placeholder="Address" value={r.addressLine1 ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, addressLine1: e.target.value } : x)))} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={inputStyle} placeholder="Move-in" type="date" value={r.moveInDate ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, moveInDate: e.target.value } : x)))} />
                      <input style={inputStyle} placeholder="Move-out (blank if current)" type="date" value={r.moveOutDate ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, moveOutDate: e.target.value } : x)))} />
                    </div>
                    <input style={inputStyle} placeholder="Monthly rent ($)" type="number" min={0} value={r.monthlyRentCents != null ? r.monthlyRentCents / 100 : ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, monthlyRentCents: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined } : x)))} />
                    <input style={inputStyle} placeholder="Landlord name" value={r.landlordName ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, landlordName: e.target.value } : x)))} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={inputStyle} placeholder="Landlord phone" value={r.landlordPhone ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, landlordPhone: e.target.value } : x)))} />
                      <input style={inputStyle} placeholder="Landlord email" value={r.landlordEmail ?? ''} onChange={(e) => setRentalHistory(rentalHistory.map((x, j) => (j === i ? { ...x, landlordEmail: e.target.value } : x)))} />
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => setRentalHistory(rentalHistory.filter((_, j) => j !== i))} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', color: theme.danger, fontSize: 12, cursor: 'pointer', width: 'fit-content' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button type="button" onClick={() => setRentalHistory([...rentalHistory, { addressLine1: '' }])} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${theme.primary}`, background: 'white', color: theme.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    + Add prior address
                  </button>
                )}
                <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>Reason for moving<input style={inputStyle} value={form.reasonForMoving} onChange={(e) => setForm({ ...form, reasonForMoving: e.target.value })} /></label>
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>References</h2>
                {references.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gap: 6, padding: 10, border: `1px solid ${theme.border}`, borderRadius: 8, marginBottom: 8 }}>
                    <input style={inputStyle} placeholder="Name" value={r.name} onChange={(e) => setReferences(references.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={inputStyle} placeholder="Relationship" value={r.relationship} onChange={(e) => setReferences(references.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))} />
                      <input style={inputStyle} placeholder="Phone" value={r.phone} onChange={(e) => setReferences(references.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                      <input style={inputStyle} placeholder="Email" value={r.email} onChange={(e) => setReferences(references.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => setReferences(references.filter((_, j) => j !== i))} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'white', color: theme.danger, fontSize: 12, cursor: 'pointer', width: 'fit-content' }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button type="button" onClick={() => setReferences([...references, { name: '', relationship: '', phone: '', email: '' }])} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${theme.primary}`, background: 'white', color: theme.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    + Add reference
                  </button>
                )}
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Pets & Vehicles</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={form.hasPets} onChange={(e) => setForm({ ...form, hasPets: e.target.checked })} /> I have pets
                </label>
                {form.hasPets && <input style={inputStyle} placeholder="Type, breed/size, number of pets" value={form.petDetails} onChange={(e) => setForm({ ...form, petDetails: e.target.value })} />}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 10 }}>
                  <input type="checkbox" checked={form.hasVehicles} onChange={(e) => setForm({ ...form, hasVehicles: e.target.checked })} /> I have vehicles that will need parking
                </label>
                {form.hasVehicles && <input style={inputStyle} placeholder="Make, model, license plate" value={form.vehicleDetails} onChange={(e) => setForm({ ...form, vehicleDetails: e.target.value })} />}
              </div>

              <div style={sectionStyle}>
                <h2 style={{ fontSize: 15, marginTop: 0 }}>Guarantor / Co-signer</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={form.hasGuarantor} onChange={(e) => setForm({ ...form, hasGuarantor: e.target.checked })} /> I'm applying with a guarantor/co-signer
                </label>
                {form.hasGuarantor && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    <input style={inputStyle} placeholder="Guarantor full name" value={form.guarantorFullName} onChange={(e) => setForm({ ...form, guarantorFullName: e.target.value })} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={inputStyle} placeholder="Phone" value={form.guarantorPhone} onChange={(e) => setForm({ ...form, guarantorPhone: e.target.value })} />
                      <input style={inputStyle} placeholder="Email" value={form.guarantorEmail} onChange={(e) => setForm({ ...form, guarantorEmail: e.target.value })} />
                    </div>
                    <input style={inputStyle} placeholder="Guarantor monthly income ($)" type="number" min={0} value={form.guarantorMonthlyIncomeCents} onChange={(e) => setForm({ ...form, guarantorMonthlyIncomeCents: e.target.value })} />
                  </div>
                )}
              </div>

              {canEdit && (
                <button type="submit" disabled={busy} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: theme.primary, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  {busy ? 'Saving...' : 'Save draft'}
                </button>
              )}
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}
