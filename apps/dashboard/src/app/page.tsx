import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: 24, textAlign: 'center' }}>
      <h1>Affordable Home Match</h1>
      <p style={{ color: '#555' }}>
        Landlords and tenants communicate through the platform relay — never sharing real phone
        numbers directly.
      </p>
      <p>
        <Link href="/login">Sign in</Link> · <Link href="/properties">Browse properties</Link>
      </p>
    </main>
  );
}
