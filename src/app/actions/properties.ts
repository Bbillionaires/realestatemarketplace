"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/dal";
import {
  PropertySchema,
  PropertyFormState,
  UtilityTypeValues,
} from "@/lib/definitions";

async function resolveOwnerAndManager(
  role: "LANDLORD" | "PROPERTY_MANAGER",
  userId: string,
  managerEmail: string | undefined,
  ownerEmail: string | undefined
): Promise<{ ownerId: string; managerId: string | null } | { error: string }> {
  if (role === "LANDLORD") {
    let managerId: string | null = null;
    if (managerEmail) {
      const manager = await prisma.user.findUnique({ where: { email: managerEmail } });
      if (!manager || manager.role !== "PROPERTY_MANAGER") {
        return { error: "No property manager account found with that email." };
      }
      managerId = manager.id;
    }
    return { ownerId: userId, managerId };
  }

  if (!ownerEmail) {
    return { error: "Enter the landlord's email to assign this listing to their account." };
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner || owner.role !== "LANDLORD") {
    return { error: "No landlord account found with that email." };
  }
  return { ownerId: owner.id, managerId: userId };
}

function utilitiesFromFormData(formData: FormData) {
  return UtilityTypeValues.map((type) => {
    const paidBy = formData.get(`utility_${type}`);
    if (!paidBy || paidBy === "") return null;
    return { type, paidBy: paidBy as "LANDLORD" | "TENANT" | "SPLIT" };
  }).filter((v): v is { type: (typeof UtilityTypeValues)[number]; paidBy: "LANDLORD" | "TENANT" | "SPLIT" } => v !== null);
}

export async function saveProperty(
  _state: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");

  const raw = Object.fromEntries(formData.entries());
  const validated = PropertySchema.safeParse(raw);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { managerEmail, ownerEmail, ...data } = validated.data;
  const propertyId = formData.get("id");
  const utilities = utilitiesFromFormData(formData);

  if (typeof propertyId === "string" && propertyId) {
    const existing = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!existing || (existing.ownerId !== session.userId && existing.managerId !== session.userId)) {
      return { message: "You don't have permission to edit this listing." };
    }

    await prisma.$transaction([
      prisma.propertyUtility.deleteMany({ where: { propertyId } }),
      prisma.property.update({
        where: { id: propertyId },
        data: {
          ...data,
          utilities: { create: utilities },
        },
      }),
    ]);

    revalidatePath(`/dashboard`);
    redirect(`/dashboard/properties/${propertyId}/edit?saved=1`);
  }

  const resolved = await resolveOwnerAndManager(
    session.role as "LANDLORD" | "PROPERTY_MANAGER",
    session.userId,
    managerEmail,
    ownerEmail
  );
  if ("error" in resolved) {
    return { message: resolved.error };
  }

  const property = await prisma.property.create({
    data: {
      ...data,
      ownerId: resolved.ownerId,
      managerId: resolved.managerId,
      utilities: { create: utilities },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/properties/${property.id}/edit?created=1`);
}

async function assertPropertyAccess(propertyId: string, userId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || (property.ownerId !== userId && property.managerId !== userId)) {
    throw new Error("You don't have permission to modify this listing.");
  }
  return property;
}

export async function publishProperty(formData: FormData) {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  const propertyId = String(formData.get("id"));
  await assertPropertyAccess(propertyId, session.userId);
  await prisma.property.update({ where: { id: propertyId }, data: { status: "PUBLISHED" } });
  revalidatePath("/dashboard");
}

export async function archiveProperty(formData: FormData) {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  const propertyId = String(formData.get("id"));
  await assertPropertyAccess(propertyId, session.userId);
  await prisma.property.update({ where: { id: propertyId }, data: { status: "ARCHIVED" } });
  revalidatePath("/dashboard");
}

export async function deleteProperty(formData: FormData) {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  const propertyId = String(formData.get("id"));
  await assertPropertyAccess(propertyId, session.userId);
  await prisma.property.delete({ where: { id: propertyId } });
  revalidatePath("/dashboard");
}

export async function createAvailabilitySlot(formData: FormData) {
  const session = await requireSession();
  if (session.role === "TENANT") throw new Error("Only landlords and property managers can set availability.");

  const propertyId = String(formData.get("propertyId"));
  await assertPropertyAccess(propertyId, session.userId);

  const startTime = new Date(String(formData.get("startTime")));
  const endTime = new Date(String(formData.get("endTime")));
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    throw new Error("Invalid time range.");
  }

  await prisma.availabilitySlot.create({
    data: { propertyId, createdById: session.userId, startTime, endTime },
  });
  revalidatePath(`/dashboard/properties/${propertyId}/availability`);
}

export async function deleteAvailabilitySlot(formData: FormData) {
  const session = await requireSession();
  const slotId = String(formData.get("slotId"));
  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot) return;
  await assertPropertyAccess(slot.propertyId, session.userId);
  if (slot.isBooked) throw new Error("Can't delete a slot that's already booked.");
  await prisma.availabilitySlot.delete({ where: { id: slotId } });
  revalidatePath(`/dashboard/properties/${slot.propertyId}/availability`);
}
