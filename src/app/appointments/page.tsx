import { requireSession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { cancelAppointment } from "@/app/actions/booking";

export default async function AppointmentsPage() {
  const session = await requireSession();

  const appointments =
    session.role === "TENANT"
      ? await prisma.appointment.findMany({
          where: { tenantId: session.userId },
          include: { property: true, slot: true, tenant: true },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.appointment.findMany({
          where: {
            property: { OR: [{ ownerId: session.userId }, { managerId: session.userId }] },
          },
          include: { property: true, slot: true, tenant: true },
          orderBy: { createdAt: "desc" },
        });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Appointments</h1>

      {appointments.length === 0 && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No appointments yet.</p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {appointments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{a.property.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {new Date(a.slot.startTime).toLocaleString()}
                {session.role !== "TENANT" ? ` · ${a.tenant.name}` : ""}
              </p>
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                  a.status === "CONFIRMED"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : a.status === "CANCELLED"
                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {a.status}
              </span>
            </div>
            {a.status === "CONFIRMED" && (
              <form action={cancelAppointment}>
                <input type="hidden" name="appointmentId" value={a.id} />
                <button className="text-sm text-red-600 underline">Cancel</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
