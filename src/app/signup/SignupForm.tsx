"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

const ROLES = [
  { value: "TENANT", label: "Tenant", blurb: "Browse listings & apply — free" },
  { value: "LANDLORD", label: "Landlord", blurb: "List your rental properties" },
  { value: "PROPERTY_MANAGER", label: "Property Manager", blurb: "Manage listings for owners" },
] as const;

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <fieldset className="grid grid-cols-3 gap-2">
        {ROLES.map((r) => (
          <label
            key={r.value}
            className="flex cursor-pointer flex-col rounded-md border border-zinc-200 p-3 text-center text-xs has-checked:border-slate-900 has-checked:bg-slate-50 dark:border-zinc-800 dark:has-checked:border-slate-100 dark:has-checked:bg-zinc-900"
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              defaultChecked={r.value === "TENANT"}
              className="sr-only"
            />
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{r.label}</span>
            <span className="mt-1 text-zinc-500 dark:text-zinc-400">{r.blurb}</span>
          </label>
        ))}
      </fieldset>
      {state?.errors?.role && <p className="text-sm text-red-600">{state.errors.role[0]}</p>}

      <div>
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Full name
        </label>
        <input
          id="name"
          name="name"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.name && <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.password && (
          <ul className="mt-1 list-inside list-disc text-sm text-red-600">
            {state.errors.password.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}

      <SubmitButton>Create account</SubmitButton>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
