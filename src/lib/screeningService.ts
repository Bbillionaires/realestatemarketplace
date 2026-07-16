import "server-only";
import { prisma } from "@/lib/prisma";
import { evaluateScreening, ScreeningAnswers, AnswerKey } from "@/lib/screening";
import { extractAnswers, generateReply, ChatTurn } from "@/lib/ai";

const GREETING =
  "Hi! I'm the screening assistant for this property. I'll ask a few quick questions to check fit, then you can pick a showing time if everything lines up. Ready to get started? What's your approximate monthly gross income?";

export async function startScreeningSession(propertyId: string, tenantId: string) {
  await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });

  const existing = await prisma.screeningSession.findFirst({
    where: { propertyId, tenantId, status: { in: ["IN_PROGRESS", "PASSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.screeningSession.create({
    data: {
      propertyId,
      tenantId,
      messages: { create: [{ role: "ASSISTANT", content: GREETING }] },
    },
  });
}

export async function getScreeningSession(sessionId: string) {
  return prisma.screeningSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      property: true,
      answers: true,
    },
  });
}

export async function processTenantMessage(sessionId: string, content: string) {
  const session = await prisma.screeningSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: "asc" } }, property: true, answers: true },
  });

  await prisma.chatMessage.create({
    data: { screeningSessionId: sessionId, role: "USER", content },
  });

  const historyForExtraction: ChatTurn[] = [
    ...session.messages.map((m) => ({
      role: m.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
    { role: "user", content },
  ];

  const knownAnswers: ScreeningAnswers = Object.fromEntries(
    session.answers.map((a) => [a.key, a.value])
  );

  const extracted = await extractAnswers(session.property, historyForExtraction, knownAnswers);

  for (const [key, value] of Object.entries(extracted)) {
    if (!value) continue;
    await prisma.screeningAnswer.upsert({
      where: { screeningSessionId_key: { screeningSessionId: sessionId, key } },
      create: { screeningSessionId: sessionId, key: key as AnswerKey, value },
      update: { value },
    });
  }

  const mergedAnswers: ScreeningAnswers = { ...knownAnswers, ...extracted };
  const gate = evaluateScreening(session.property, mergedAnswers);

  await prisma.screeningSession.update({
    where: { id: sessionId },
    data: { status: gate.status, score: gate.score, failReasons: gate.failReasons },
  });

  const reply = await generateReply(session.property, historyForExtraction, gate);

  await prisma.chatMessage.create({
    data: { screeningSessionId: sessionId, role: "ASSISTANT", content: reply },
  });

  return getScreeningSession(sessionId);
}
