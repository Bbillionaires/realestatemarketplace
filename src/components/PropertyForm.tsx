"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { saveProperty } from "@/app/actions/properties";
import { SubmitButton } from "@/components/SubmitButton";
import {
  UtilityTypeValues,
  PaidByValues,
  LawnCarePartyValues,
  LateFeeTypeValues,
} from "@/lib/definitions";

type ExistingProperty = {
  id: string;
  title: string;
  description: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number | null;
  rentAmount: string | number;
  securityDeposit: string | number;
  leaseLengthMonths: number;
  leaseTermNotes: string | null;
  rentDueDay: number;
  acceptsHud: boolean;
  minCreditScore: number | null;
  minMonthlyIncomeMultiple: number | null;
  requiresBackgroundCheck: boolean;
  allowsEvictionHistory: boolean;
  criteriaNotes: string | null;
  lawnCareResponsibleParty: string;
  lawnCarePaidBy: string;
  lateFeeAmount: string | number | null;
  lateFeeType: string;
  lateFeeGraceDays: number;
  workForRentAvailable: boolean;
  workForRentDescription: string | null;
  utilities: { type: string; paidBy: string }[];
};

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

export function PropertyForm({
  property,
  role,
}: {
  property?: ExistingProperty;
  role: "LANDLORD" | "PROPERTY_MANAGER";
}) {
  const [state, action] = useActionState(saveProperty, undefined);
  const searchParams = useSearchParams();
  const justSaved = searchParams.get("saved") || searchParams.get("created");

  const utilityDefault = (type: string) =>
    property?.utilities.find((u) => u.type === type)?.paidBy ?? "";

  return (
    <form action={action} className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      {property && <input type="hidden" name="id" value={property.id} />}

      {justSaved && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          Listing saved.
        </p>
      )}
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Basics</h2>
        <Field label="Title" name="title" defaultValue={property?.title} error={state?.errors?.title} />
        <TextArea
          label="Description"
          name="description"
          defaultValue={property?.description}
          error={state?.errors?.description}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Street address"
            name="addressLine1"
            defaultValue={property?.addressLine1}
            error={state?.errors?.addressLine1}
          />
          <Field label="Unit / Apt (optional)" name="addressLine2" defaultValue={property?.addressLine2 ?? ""} />
          <Field label="City" name="city" defaultValue={property?.city} error={state?.errors?.city} />
          <Field label="State" name="state" defaultValue={property?.state} error={state?.errors?.state} />
          <Field label="ZIP" name="zip" defaultValue={property?.zip} error={state?.errors?.zip} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Bedrooms"
            name="bedrooms"
            type="number"
            defaultValue={property?.bedrooms ?? 1}
            error={state?.errors?.bedrooms}
          />
          <Field
            label="Bathrooms"
            name="bathrooms"
            type="number"
            step="0.5"
            defaultValue={property?.bathrooms ?? 1}
            error={state?.errors?.bathrooms}
          />
          <Field
            label="Square feet (optional)"
            name="squareFeet"
            type="number"
            defaultValue={property?.squareFeet ?? ""}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Rent &amp; lease terms
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Monthly rent ($)"
            name="rentAmount"
            type="number"
            step="0.01"
            defaultValue={property?.rentAmount}
            error={state?.errors?.rentAmount}
          />
          <Field
            label="Security deposit ($)"
            name="securityDeposit"
            type="number"
            step="0.01"
            defaultValue={property?.securityDeposit ?? 0}
            error={state?.errors?.securityDeposit}
          />
          <Field
            label="Lease length (months)"
            name="leaseLengthMonths"
            type="number"
            defaultValue={property?.leaseLengthMonths ?? 12}
            error={state?.errors?.leaseLengthMonths}
          />
          <Field
            label="Rent due day of month"
            name="rentDueDay"
            type="number"
            defaultValue={property?.rentDueDay ?? 1}
            error={state?.errors?.rentDueDay}
          />
        </div>
        <Field
          label="Lease term notes (optional)"
          name="leaseTermNotes"
          defaultValue={property?.leaseTermNotes ?? ""}
        />
        <Checkbox label="Accepts HUD / Section 8 vouchers" name="acceptsHud" defaultChecked={property?.acceptsHud} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Tenant screening criteria
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Minimum credit score (optional)"
            name="minCreditScore"
            type="number"
            defaultValue={property?.minCreditScore ?? ""}
          />
          <Field
            label="Minimum income as multiple of rent (optional, e.g. 3)"
            name="minMonthlyIncomeMultiple"
            type="number"
            step="0.1"
            defaultValue={property?.minMonthlyIncomeMultiple ?? ""}
          />
        </div>
        <Checkbox
          label="Requires background check consent"
          name="requiresBackgroundCheck"
          defaultChecked={property?.requiresBackgroundCheck ?? true}
        />
        <Checkbox
          label="Allows applicants with prior eviction history"
          name="allowsEvictionHistory"
          defaultChecked={property?.allowsEvictionHistory}
        />
        <TextArea
          label="Other tenant criteria notes (optional)"
          name="criteriaNotes"
          defaultValue={property?.criteriaNotes ?? ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Utilities — who pays</h2>
        <div className="grid grid-cols-2 gap-3">
          {UtilityTypeValues.map((type) => (
            <label key={type} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">{UTILITY_LABEL[type]}</span>
              <select
                name={`utility_${type}`}
                defaultValue={utilityDefault(type)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">N/A</option>
                {PaidByValues.map((v) => (
                  <option key={v} value={v}>
                    {v === "SPLIT" ? "Split" : v.charAt(0) + v.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lawn care</h2>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Who cuts the grass"
            name="lawnCareResponsibleParty"
            defaultValue={property?.lawnCareResponsibleParty ?? "LANDLORD"}
            options={LawnCarePartyValues}
          />
          <SelectField
            label="Who pays for lawn care"
            name="lawnCarePaidBy"
            defaultValue={property?.lawnCarePaidBy ?? "LANDLORD"}
            options={PaidByValues}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Late fees</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Late fee amount (optional)"
            name="lateFeeAmount"
            type="number"
            step="0.01"
            defaultValue={property?.lateFeeAmount ?? ""}
          />
          <SelectField
            label="Fee type"
            name="lateFeeType"
            defaultValue={property?.lateFeeType ?? "FLAT"}
            options={LateFeeTypeValues}
          />
          <Field
            label="Grace days"
            name="lateFeeGraceDays"
            type="number"
            defaultValue={property?.lateFeeGraceDays ?? 0}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Work-for-rent option
        </h2>
        <Checkbox
          label="Offer a job opportunity to work off rent (in full or the unpaid difference)"
          name="workForRentAvailable"
          defaultChecked={property?.workForRentAvailable}
        />
        <TextArea
          label="Describe the work-for-rent arrangement (optional)"
          name="workForRentDescription"
          defaultValue={property?.workForRentDescription ?? ""}
        />
      </section>

      {!property && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ownership</h2>
          {role === "LANDLORD" ? (
            <Field
              label="Assign a property manager by email (optional)"
              name="managerEmail"
              type="email"
            />
          ) : (
            <Field
              label="Landlord's email (required — this listing will be assigned to their account)"
              name="ownerEmail"
              type="email"
            />
          )}
        </section>
      )}

      <SubmitButton>{property ? "Save changes" : "Create listing"}</SubmitButton>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string | number | null;
  error?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error[0]}</p>}
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error[0]}</p>}
    </div>
  );
}

function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
