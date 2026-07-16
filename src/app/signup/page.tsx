import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Create your free account
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Tenants browse and apply for free. Landlords and property managers list
          properties for free too.
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
