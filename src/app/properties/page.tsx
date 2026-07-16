import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import type { Prisma } from "@/generated/prisma/client";

export default async function BrowsePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; hud?: string }>;
}) {
  await requireSession();
  const { city, hud } = await searchParams;

  const where: Prisma.PropertyWhereInput = { status: "PUBLISHED" };
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (hud === "1") where.acceptsHud = true;

  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Available properties
      </h1>

      <form className="mt-4 flex items-end gap-3">
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">City</label>
          <input
            name="city"
            defaultValue={city}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="hud" value="1" defaultChecked={hud === "1"} className="h-4 w-4" />
          Accepts HUD only
        </label>
        <button className="mb-0.5 rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Filter
        </button>
      </form>

      {properties.length === 0 && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          No published listings match your search yet.
        </p>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {properties.map((p) => (
          <li key={p.id}>
            <Link
              href={`/properties/${p.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            >
              <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{p.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {p.city}, {p.state} · {p.bedrooms} bd / {p.bathrooms} ba
              </p>
              <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
                ${Number(p.rentAmount).toFixed(0)}/mo
              </p>
              {p.acceptsHud && (
                <span className="mt-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Accepts HUD
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
