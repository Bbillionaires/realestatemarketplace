import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PropertyForm } from "@/components/PropertyForm";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: { utilities: true },
  });

  if (!property || (property.ownerId !== session.userId && property.managerId !== session.userId)) {
    notFound();
  }

  return (
    <div>
      <h1 className="mx-auto max-w-2xl px-4 pt-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit listing
      </h1>
      <PropertyForm
        role={session.role as "LANDLORD" | "PROPERTY_MANAGER"}
        property={{
          ...property,
          rentAmount: property.rentAmount.toString(),
          securityDeposit: property.securityDeposit.toString(),
          lateFeeAmount: property.lateFeeAmount?.toString() ?? null,
        }}
      />
    </div>
  );
}
