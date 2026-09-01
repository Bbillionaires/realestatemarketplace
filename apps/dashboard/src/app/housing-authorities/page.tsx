import { InfoPage, InfoSection } from '../../components/InfoPage';
import { HOUSING_AUTHORITIES } from '../../data/housingAuthorities';
import { theme } from '../../lib/theme';

export default function HousingAuthoritiesPage() {
  return (
    <InfoPage
      title="Housing Authority & Case Worker Directory"
      subtitle="Quick contacts to help voucher holders and case workers connect with local housing authorities."
    >
      <InfoSection heading="Local housing authorities">
        <div style={{ display: 'grid', gap: 16 }}>
          {HOUSING_AUTHORITIES.map((ha) => (
            <div
              key={ha.name}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{ha.name}</div>
              <div style={{ marginTop: 6, fontSize: 14, color: theme.textMuted, display: 'grid', gap: 2 }}>
                {ha.phone && <span>Phone: {ha.phone}</span>}
                {ha.email && <span>Email: {ha.email}</span>}
                {ha.website && (
                  <a href={ha.website} target="_blank" rel="noreferrer" style={{ color: theme.primary }}>
                    {ha.website}
                  </a>
                )}
              </div>
              {ha.note && (
                <div style={{ marginTop: 8, fontSize: 12, color: theme.warningText, background: theme.warningBg, padding: '6px 10px', borderRadius: 8 }}>
                  {ha.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </InfoSection>
      <InfoSection heading="Are you a case worker?">
        <p>
          Message us through <a href="/contact" style={{ color: theme.primary }}>Contact Us</a> to get help searching
          our inventory of voucher-friendly listings on behalf of your clients.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
