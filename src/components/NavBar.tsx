import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

const ROLE_LABEL: Record<string, string> = {
  LANDLORD: "Landlord",
  TENANT: "Tenant",
  PROPERTY_MANAGER: "Property Manager",
};

export async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          HomeKey
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="hidden text-zinc-500 sm:inline dark:text-zinc-400">
                {ROLE_LABEL[user.role]}
              </span>
              <Link href="/dashboard" className="text-zinc-700 hover:underline dark:text-zinc-300">
                Dashboard
              </Link>
              <Link href="/properties" className="text-zinc-700 hover:underline dark:text-zinc-300">
                Browse
              </Link>
              <Link
                href="/appointments"
                className="text-zinc-700 hover:underline dark:text-zinc-300"
              >
                Appointments
              </Link>
              <form action={logout}>
                <button className="text-zinc-700 hover:underline dark:text-zinc-300" type="submit">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-700 hover:underline dark:text-zinc-300">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
