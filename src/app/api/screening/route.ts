import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { startScreeningSession } from "@/lib/screeningService";

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "TENANT") {
    return NextResponse.json(
      { error: "Only tenant accounts can start a screening chat." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const propertyId = body?.propertyId;
  if (typeof propertyId !== "string") {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  try {
    const screeningSession = await startScreeningSession(propertyId, session.userId);
    return NextResponse.json({ id: screeningSession.id });
  } catch (err) {
    console.error("Failed to start screening session:", err);
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
}
