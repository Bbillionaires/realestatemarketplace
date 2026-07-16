import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Property } from "@/generated/prisma/client";
import type { ScreeningAnswers, ScreeningResult } from "@/lib/screening";

const MODEL = "claude-sonnet-5";

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  return new Anthropic({ apiKey });
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "submit_screening_answers",
  description:
    "Record any of the tenant's screening answers that can be confidently determined from their latest message. Omit fields that are still unknown. Call this every turn, even with an empty object if nothing new was learned.",
  input_schema: {
    type: "object",
    properties: {
      monthlyIncome: {
        type: "string",
        description: "Tenant's gross monthly income in US dollars, digits only, e.g. '4200'.",
      },
      creditScore: {
        type: "string",
        description: "Tenant's approximate credit score, digits only, e.g. '680'.",
      },
      hasHudVoucher: {
        type: "string",
        enum: ["yes", "no"],
        description: "Whether the tenant has a HUD/Section 8 housing voucher.",
      },
      evictionHistory: {
        type: "string",
        enum: ["yes", "no"],
        description: "Whether the tenant has ever been evicted.",
      },
      desiredMoveInDate: {
        type: "string",
        description: "Tenant's desired move-in date, in their own words or ISO format.",
      },
      consentBackgroundCheck: {
        type: "string",
        enum: ["yes", "no"],
        description: "Whether the tenant consents to a background check.",
      },
    },
    required: [],
  },
};

function propertySummary(property: Property): string {
  const lines = [
    `Address: ${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`,
    `Rent: $${Number(property.rentAmount).toFixed(2)}/month, due day ${property.rentDueDay} of the month`,
    `Security deposit: $${Number(property.securityDeposit).toFixed(2)}`,
    `Lease length: ${property.leaseLengthMonths} months${property.leaseTermNotes ? ` (${property.leaseTermNotes})` : ""}`,
    `Accepts HUD/Section 8 vouchers: ${property.acceptsHud ? "yes" : "no"}`,
    property.minCreditScore != null ? `Minimum credit score: ${property.minCreditScore}` : null,
    property.minMonthlyIncomeMultiple != null
      ? `Minimum monthly income: ${property.minMonthlyIncomeMultiple}x rent`
      : null,
    `Background check required: ${property.requiresBackgroundCheck ? "yes" : "no"}`,
    `Accepts applicants with prior eviction: ${property.allowsEvictionHistory ? "yes" : "no"}`,
    property.criteriaNotes ? `Other tenant criteria: ${property.criteriaNotes}` : null,
    `Lawn care handled by: ${property.lawnCareResponsibleParty}, paid by: ${property.lawnCarePaidBy}`,
    property.lateFeeAmount != null
      ? `Late fee: ${property.lateFeeType === "PERCENTAGE" ? `${property.lateFeeAmount}%` : `$${Number(property.lateFeeAmount).toFixed(2)}`} after ${property.lateFeeGraceDays} grace day(s)`
      : "Late fee: none specified",
    property.workForRentAvailable
      ? `Work-for-rent option available: ${property.workForRentDescription ?? "ask landlord for details"}`
      : "Work-for-rent option: not offered",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function extractAnswers(
  property: Property,
  history: ChatTurn[],
  knownAnswers: ScreeningAnswers
): Promise<ScreeningAnswers> {
  const system = `You extract structured tenant-screening data from a rental applicant's chat messages. Property terms:\n${propertySummary(property)}\n\nAlready known answers: ${JSON.stringify(knownAnswers)}\n\nCall submit_screening_answers with only newly-learned or corrected fields from the tenant's latest message.`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    system,
    messages: history.map((t) => ({ role: t.role, content: t.content })),
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "submit_screening_answers" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) return {};
  return toolUse.input as ScreeningAnswers;
}

export async function generateReply(
  property: Property,
  history: ChatTurn[],
  gate: ScreeningResult
): Promise<string> {
  const gateSummary =
    gate.status === "IN_PROGRESS"
      ? `Still missing required info: ${gate.missingKeys.join(", ")}. Ask for ONE missing item next, conversationally.`
      : gate.status === "PASSED"
        ? "The applicant PASSES this property's screening criteria. Tell them they're ready to book a showing and to pick a time from the calendar shown below the chat. Do not attempt to book anything yourself."
        : `The applicant does NOT pass this property's screening criteria. Reasons: ${gate.failReasons.join("; ")}. Explain the reasons plainly and courteously. Do not offer to book a showing.`;

  const system = `You are a rental-screening assistant for a real estate marketplace. You are chatting with a prospective tenant about this specific property:\n${propertySummary(property)}\n\nYour job: (1) answer the tenant's questions about the listing using only the facts above, (2) collect the required screening info (monthly income, credit score, HUD voucher status, eviction history, desired move-in date, and background-check consent if required) through natural conversation, one question at a time, (3) once the required info gate below says PASSED or FAILED, clearly communicate that outcome instead of continuing to ask questions.\n\nCurrent gate status: ${gate.status}. ${gateSummary}\n\nBe warm but efficient — do not waste the tenant's time with unnecessary chit-chat.`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: history.map((t) => ({ role: t.role, content: t.content })),
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return text?.text ?? "";
}
