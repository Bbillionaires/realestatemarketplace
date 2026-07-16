import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slots = await prisma.availabilitySlot.findMany({
    where: { propertyId: id, isBooked: false, startTime: { gt: new Date() } },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({
    slots: slots.map((s) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime })),
  });
}
