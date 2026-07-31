'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, PropertyType } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { useCurrentUser } from '../../../lib/use-current-user';
import { theme } from '../../../lib/theme';
import { NavBar } from '../../../components/NavBar';

const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOME', label: 'Townhome' },
  { value: 'OTHER', label: 'Other' },
];

function dollarsToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  return Math.round(parsed * 100);
}

export default function NewPropertyPage() {
  const { accessToken } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [petPolicy, setPetPolicy] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('APARTMENT');
  const [acceptsSection8Vouchers, setAcceptsSection8Vouchers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginTop: 6,
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  };
  const labelStyle = { display: 'block', marginBottom: 14, fontSize: 13, color: theme.textMuted, fontWeight: 600 };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSaving(true);
    try {
      const created = await api.createProperty(accessToken, {
        title,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city,
        state,
        zip,
        description: description || undefined,
        monthlyRentCents: dollarsToCents(monthlyRent),
        depositCents: dollarsToCents(deposit),
        petPolicy: petPolicy || undefined,
        propertyType,
        acceptsSection8Vouchers,
      });
      router.push(`/properties/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setSaving(false);
    }
  }

  if (userLoading) {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <p style={{ padding: 24 }}>Loading...</p>
      </main>
    );
  }

  if (!user || user.role !== 'LANDLORD') {
    return (
      <main style={{ minHeight: '100vh', background: theme.bg }}>
        <NavBar />
        <div style={{ maxWidth: 560, margin: '40px auto', padding: 24 }}>
          <h1 style={{ fontSize: 20, color: theme.text }}>List Your Property</h1>
          <p style={{ color: theme.textMuted, fontSize: 14 }}>
            Only property owners (landlords) can create a new listing. If you manage a property on behalf of an
            owner, ask them to assign you as a manager on the listing instead.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: theme.bg }}>
      <NavBar />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, color: theme.text, marginBottom: 4 }}>List Your Property</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          Add a new rental listing. You can add units, photos, and additional listing options after it's created.
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            boxShadow: theme.shadow,
            padding: 24,
          }}
        >
          <label style={labelStyle}>
            Listing title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Address line 1
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required maxLength={200} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Address line 2 (optional)
            <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} maxLength={200} style={inputStyle} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 2 }}>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} required maxLength={100} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              State
              <input value={state} onChange={(e) => setState(e.target.value)} required maxLength={50} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              ZIP
              <input value={zip} onChange={(e) => setZip(e.target.value)} required maxLength={20} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Monthly rent ($)
              <input
                type="number"
                min={0}
                step="1"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Security deposit ($)
              <input
                type="number"
                min={0}
                step="1"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Property type
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} style={inputStyle}>
              {PROPERTY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Pet policy (optional)
            <input value={petPolicy} onChange={(e) => setPetPolicy(e.target.value)} maxLength={300} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={acceptsSection8Vouchers}
              onChange={(e) => setAcceptsSection8Vouchers(e.target.checked)}
            />
            This property accepts Section 8 housing vouchers
          </label>

          {error && (
            <p style={{ color: theme.danger, fontSize: 13, background: '#fdecec', padding: '8px 10px', borderRadius: 6 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: theme.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Creating listing...' : 'Create listing'}
          </button>
        </form>
      </div>
    </main>
  );
}
