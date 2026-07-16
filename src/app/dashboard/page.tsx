import Link from "next/link";
import { requireSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { publishProperty, archiveProperty, deleteProperty } from "@/app/actions/properties";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ARCHIVED: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

async function LandlordDashboard({ userId }: { userId: string }) {
  const properties = await prisma.property.findMany({
    where: { OR: [{ ownerId: userId }, { managerId: userId }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { appointments: true, screeningSessions: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your listings</h1>
        <Link
          href="/dashboard/properties/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          + New listing
        </Link>
      </div>

      {properties.length === 0 && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          You don&apos;t have any listings yet.{" "}
          <Link href="/dashboard/properties/new" className="underline">
            Create your first one
          </Link>
          .
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {properties.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{p.title}</h2>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {p.addressLine1}, {p.city}, {p.state} — ${Number(p.rentAmount).toFixed(0)}/mo
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  {p._count.screeningSessions} screening chat(s) · {p._count.appointments} showing(s)
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 text-sm">
                <Link href={`/dashboard/properties/${p.id}/edit`} className="underline">
                  Edit
                </Link>
                <Link href={`/dashboard/properties/${p.id}/availability`} className="underline">
                  Availability
                </Link>
                {p.status !== "PUBLISHED" && (
                  <form action={publishProperty}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-left underline">Publish</button>
                  </form>
                )}
                {p.status !== "ARCHIVED" && (
                  <form action={archiveProperty}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-left underline">Archive</button>
                  </form>
                )}
                <form action={deleteProperty}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-left text-red-600 underline">Delete</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function TenantDashboard({ userId }: { userId: string }) {
  const [sessions, appointments] = await Promise.all([
    prisma.screeningSession.findMany({
      where: { tenantId: userId },
      orderBy: { createdAt: "desc" },
      include: { property: true },
      take: 10,
    }),
    prisma.appointment.findMany({
      where: { tenantId: userId, status: "CONFIRMED" },
      include: { property: true, slot: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your activity</h1>
        <Link
          href="/properties"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Browse properties
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Upcoming showings
      </h2>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No showings booked yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {appointments.map((a) => (
            <li key={a.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              {a.property.title} — {new Date(a.slot.startTime).toLocaleString()}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Screening chats
      </h2>
      {sessions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No screening chats started yet.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <span>{s.property.title}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">{s.status}</span>
                <Link href={`/properties/${s.propertyId}/chat`} className="underline">
                  Open chat
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  if (session.role === "TENANT") return <TenantDashboard userId={session.userId} />;
  return <LandlordDashboard userId={session.userId} />;
}
