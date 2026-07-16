import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createAvailabilitySlot, deleteAvailabilitySlot } from "@/app/actions/properties";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: { availabilitySlots: { orderBy: { startTime: "asc" } } },
  });

  if (!property || (property.ownerId !== session.userId && property.managerId !== session.userId)) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Showing availability — {property.title}
      </h1>

      <form action={createAvailabilitySlot} className="mt-6 flex items-end gap-3">
        <input type="hidden" name="propertyId" value={property.id} />
        <div className="flex-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Start</label>
          <input
            type="datetime-local"
            name="startTime"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">End</label>
          <input
            type="datetime-local"
            name="endTime"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <SubmitButton>Add slot</SubmitButton>
      </form>

      <ul className="mt-8 flex flex-col gap-2">
        {property.availabilitySlots.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No showing slots yet.</p>
        )}
        {property.availabilitySlots.map((slot) => (
          <li
            key={slot.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <span>
              {new Date(slot.startTime).toLocaleString()} –{" "}
              {new Date(slot.endTime).toLocaleTimeString()}
              {slot.isBooked && (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Booked
                </span>
              )}
            </span>
            {!slot.isBooked && (
              <form action={deleteAvailabilitySlot}>
                <input type="hidden" name="slotId" value={slot.id} />
                <button className="text-red-600 underline">Remove</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
