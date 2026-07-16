"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/dal";

export async function bookAppointment(formData: FormData) {
  const session = await requireRole("TENANT");
  const slotId = String(formData.get("slotId"));
  const screeningSessionId = String(formData.get("screeningSessionId"));

  const screening = await prisma.screeningSession.findUnique({
    where: { id: screeningSessionId },
  });
  if (!screening || screening.tenantId !== session.userId) {
    throw new Error("Screening session not found.");
  }
  if (screening.status !== "PASSED") {
    throw new Error("You need to pass screening for this property before booking a showing.");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.availabilitySlot.updateMany({
      where: { id: slotId, propertyId: screening.propertyId, isBooked: false },
      data: { isBooked: true },
    });
    if (updated.count === 0) {
      throw new Error("That time slot is no longer available — pick another one.");
    }
    await tx.appointment.create({
      data: {
        propertyId: screening.propertyId,
        tenantId: session.userId,
        slotId,
        screeningSessionId,
      },
    });
  });

  revalidatePath("/appointments");
  redirect("/appointments?booked=1");
}

export async function cancelAppointment(formData: FormData) {
  const session = await requireSession();
  const appointmentId = String(formData.get("appointmentId"));

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { property: true },
  });
  if (!appointment) return;

  const isTenant = appointment.tenantId === session.userId;
  const managesProperty =
    appointment.property.ownerId === session.userId ||
    appointment.property.managerId === session.userId;
  if (!isTenant && !managesProperty) {
    throw new Error("You don't have permission to cancel this appointment.");
  }

  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED" } }),
    prisma.availabilitySlot.update({ where: { id: appointment.slotId }, data: { isBooked: false } }),
  ]);

  revalidatePath("/appointments");
}
