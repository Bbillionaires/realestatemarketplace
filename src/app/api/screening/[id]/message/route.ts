import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { getScreeningSession, processTenantMessage } from "@/lib/screeningService";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getScreeningSession(id);
  if (!existing || existing.tenantId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "This screening has already concluded." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const updated = await processTenantMessage(id, content.trim());
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      score: updated.score,
      failReasons: updated.failReasons,
      messages: updated.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("Screening message failed:", err);
    return NextResponse.json(
      { error: "The screening assistant is temporarily unavailable. Please try again shortly." },
      { status: 502 }
    );
  }
}
