import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getScreeningSession } from "@/lib/screeningService";
import { prisma } from "@/lib/prisma";
import { ChatClient } from "@/components/ChatClient";

export default async function ScreeningChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const session = await requireRole("TENANT");
  const { id: propertyId } = await params;
  const { session: sessionId } = await searchParams;

  if (!sessionId) notFound();

  const screening = await getScreeningSession(sessionId);
  if (!screening || screening.tenantId !== session.userId || screening.propertyId !== propertyId) {
    notFound();
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) notFound();

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col px-4 py-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Screening chat — {property.title}
      </h1>
      <div className="mt-4 flex-1 overflow-hidden">
        <ChatClient
          sessionId={screening.id}
          propertyId={propertyId}
          initialMessages={screening.messages.map((m) => ({
            id: m.id,
            role: m.role as "USER" | "ASSISTANT",
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          }))}
          initialStatus={screening.status}
          initialFailReasons={screening.failReasons}
        />
      </div>
    </div>
  );
}
