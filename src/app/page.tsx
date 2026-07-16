import Link from "next/link";

const ROLES = [
  {
    title: "Landlords",
    body: "List your rental with full lease terms — HUD acceptance, price, lease length, tenant criteria, utility split, lawn care, late fees, and work-for-rent options. Set your own showing availability.",
  },
  {
    title: "Tenants",
    body: "Join free to browse listings. Chat with our AI screening assistant — it asks a few quick questions and only opens the booking calendar once you meet the landlord's stated criteria.",
  },
  {
    title: "Property Managers",
    body: "Manage listings on behalf of landlords: publish properties, set showing availability, and track screening results and appointments in one dashboard.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <section className="mx-auto w-full max-w-5xl px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Rent smarter. Screen faster.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          A rental marketplace where every listing states its terms up front, and an
          AI assistant pre-screens tenants against the landlord&apos;s own criteria
          before anyone&apos;s calendar gets booked.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            Sign up free
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 pb-24 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div
            key={r.title}
            className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{r.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{r.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
