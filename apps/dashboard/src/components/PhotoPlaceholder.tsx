export function PhotoPlaceholder({
  height = 180,
  photoUrl,
  radius = 8,
}: {
  height?: number;
  photoUrl?: string | null;
  radius?: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        style={{ height, width: '100%', objectFit: 'cover', borderRadius: radius, display: 'block' }}
      />
    );
  }

  return (
    <div
      style={{
        height,
        borderRadius: radius,
        background: 'linear-gradient(135deg, #dbe7f3 0%, #c3d6ea 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b8bab" strokeWidth="1.5">
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
