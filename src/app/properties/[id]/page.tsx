import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import { StartScreeningButton } from "@/components/StartScreeningButton";

const UTILITY_LABEL: Record<string, string> = {
  ELECTRIC: "Electric",
  GAS: "Gas",
  WATER: "Water",
  SEWER: "Sewer",
  TRASH: "Trash",
  INTERNET: "Internet",
  CABLE: "Cable",
  OTHER: "Other",
};

const PAID_BY_LABEL: Record<string, string> = {
  LANDLORD: "Landlord pays",
  TENANT: "Tenant pays",
  SPLIT: "Split",
};

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: { utilities: true },
  });

  if (!property || property.status !== "PUBLISHED") notFound();

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {property.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {property.addressLine1}
          {property.addressLine2 ? `, ${property.addressLine2}` : ""}, {property.city},{" "}
          {property.state} {property.zip}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {property.description}
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <Detail label="Rent" value={`$${Number(property.rentAmount).toFixed(2)}/month`} />
          <Detail
            label="Security deposit"
            value={`$${Number(property.securityDeposit).toFixed(2)}`}
          />
          <Detail label="Bedrooms / bathrooms" value={`${property.bedrooms} bd / ${property.bathrooms} ba`} />
          <Detail label="Square feet" value={property.squareFeet ? String(property.squareFeet) : "—"} />
          <Detail label="Lease length" value={`${property.leaseLengthMonths} months`} />
          <Detail label="Rent due" value={`Day ${property.rentDueDay} of each month`} />
          <Detail label="Accepts HUD / Section 8" value={property.acceptsHud ? "Yes" : "No"} />
          <Detail
            label="Late fee"
            value={
              property.lateFeeAmount != null
                ? `${property.lateFeeType === "PERCENTAGE" ? `${property.lateFeeAmount}%` : `$${Number(property.lateFeeAmount).toFixed(2)}`} after ${property.lateFeeGraceDays} grace day(s)`
                : "None specified"
            }
          />
          <Detail
            label="Lawn care"
            value={`Cut by ${property.lawnCareResponsibleParty.replaceAll("_", " ").toLowerCase()}, paid by ${PAID_BY_LABEL[property.lawnCarePaidBy].toLowerCase()}`}
          />
        </dl>

        {property.leaseTermNotes && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            <strong>Lease notes:</strong> {property.leaseTermNotes}
          </p>
        )}

        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Tenant criteria
        </h2>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
          {property.minCreditScore != null && <li>Minimum credit score: {property.minCreditScore}</li>}
          {property.minMonthlyIncomeMultiple != null && (
            <li>Minimum monthly income: {property.minMonthlyIncomeMultiple}x rent</li>
          )}
          <li>Background check required: {property.requiresBackgroundCheck ? "Yes" : "No"}</li>
          <li>Prior eviction accepted: {property.allowsEvictionHistory ? "Yes" : "No"}</li>
        </ul>
        {property.criteriaNotes && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{property.criteriaNotes}</p>
        )}

        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Utilities statement
        </h2>
        {property.utilities.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Not specified.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            {property.utilities.map((u) => (
              <li key={u.type}>
                {UTILITY_LABEL[u.type]}: {PAID_BY_LABEL[u.paidBy]}
              </li>
            ))}
          </ul>
        )}

        {property.workForRentAvailable && (
          <>
            <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Work-for-rent option
            </h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {property.workForRentDescription ?? "Contact the landlord for details."}
            </p>
          </>
        )}
      </div>

      <aside className="sm:col-span-1">
        <div className="sticky top-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {session.role === "TENANT" ? (
            <StartScreeningButton propertyId={property.id} />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Screening chat &amp; booking are available to tenant accounts.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
