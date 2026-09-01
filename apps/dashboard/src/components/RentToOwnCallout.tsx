import { theme } from '../lib/theme';

// Static informational callout for v1 — intentionally not a per-user
// progress tracker (that would need its own data model and login-gated
// state; a real "credit readiness" tracker is a separate, larger feature).
export function RentToOwnCallout() {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 4,
        background: theme.primaryLight,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.primaryDark }}>
        Renting today? Prepare to buy tomorrow.
      </div>
      <p style={{ fontSize: 13, color: theme.text, marginTop: 6, marginBottom: 10 }}>
        Some of our landlords offer rent-to-own or lease-to-own paths, and building a good rental history can help
        your credit. Here are places to start:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
        <a
          href="https://www.hud.gov/findacounselor"
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.primary, fontWeight: 600 }}
        >
          Find a HUD-certified housing counselor →
        </a>
        <a
          href="https://www.hud.gov/topics/rental_assistance/local"
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.primary, fontWeight: 600 }}
        >
          Down payment assistance programs →
        </a>
      </div>
    </div>
  );
}
