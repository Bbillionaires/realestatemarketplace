import { requireRole } from "@/lib/dal";
import { PropertyForm } from "@/components/PropertyForm";

export default async function NewPropertyPage() {
  const session = await requireRole("LANDLORD", "PROPERTY_MANAGER");
  return (
    <div>
      <h1 className="mx-auto max-w-2xl px-4 pt-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New listing
      </h1>
      <PropertyForm role={session.role as "LANDLORD" | "PROPERTY_MANAGER"} />
    </div>
  );
}
