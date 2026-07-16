import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { getScreeningSession } from "@/lib/screeningService";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const screening = await getScreeningSession(id);
  if (!screening || screening.tenantId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: screening.id,
    propertyId: screening.propertyId,
    status: screening.status,
    score: screening.score,
    failReasons: screening.failReasons,
    messages: screening.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
