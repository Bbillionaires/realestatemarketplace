import type { Property } from "@/generated/prisma/client";

/**
 * Deterministic tenant-readiness gate. This is the sole authority on whether a
 * tenant is allowed to book a showing — the AI chat only collects answers and
 * explains the result. Keeping the gate rule-based (not LLM judgment) is what
 * makes "ready to book" a reliable, auditable signal instead of a guess.
 */

export const REQUIRED_ANSWER_KEYS = [
  "monthlyIncome",
  "creditScore",
  "hasHudVoucher",
  "evictionHistory",
  "desiredMoveInDate",
] as const;

export type AnswerKey = (typeof REQUIRED_ANSWER_KEYS)[number] | "consentBackgroundCheck";

export type ScreeningAnswers = Partial<Record<AnswerKey, string>>;

export type ScreeningResult = {
  status: "IN_PROGRESS" | "PASSED" | "FAILED";
  score: number;
  failReasons: string[];
  missingKeys: AnswerKey[];
};

function requiredKeysFor(property: Property): AnswerKey[] {
  const keys: AnswerKey[] = [...REQUIRED_ANSWER_KEYS];
  if (property.requiresBackgroundCheck) keys.push("consentBackgroundCheck");
  return keys;
}

function parseYesNo(value: string | undefined): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (["yes", "y", "true"].includes(v)) return true;
  if (["no", "n", "false"].includes(v)) return false;
  return null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function evaluateScreening(
  property: Property,
  answers: ScreeningAnswers
): ScreeningResult {
  const required = requiredKeysFor(property);
  const missingKeys = required.filter((k) => !answers[k] || answers[k]!.trim() === "");

  if (missingKeys.length > 0) {
    return { status: "IN_PROGRESS", score: 0, failReasons: [], missingKeys };
  }

  const failReasons: string[] = [];
  let checks = 0;
  let passedChecks = 0;

  // HUD / voucher acceptance
  checks++;
  const hasHud = parseYesNo(answers.hasHudVoucher);
  if (hasHud === true && !property.acceptsHud) {
    failReasons.push("This property does not accept HUD/Section 8 vouchers.");
  } else {
    passedChecks++;
  }

  // Minimum credit score
  if (property.minCreditScore != null) {
    checks++;
    const creditScore = parseNumber(answers.creditScore);
    if (creditScore == null || creditScore < property.minCreditScore) {
      failReasons.push(
        `Credit score below the required minimum of ${property.minCreditScore}.`
      );
    } else {
      passedChecks++;
    }
  }

  // Minimum income multiple of rent
  if (property.minMonthlyIncomeMultiple != null) {
    checks++;
    const income = parseNumber(answers.monthlyIncome);
    const requiredIncome = Number(property.rentAmount) * property.minMonthlyIncomeMultiple;
    if (income == null || income < requiredIncome) {
      failReasons.push(
        `Monthly income below the required ${property.minMonthlyIncomeMultiple}x rent ($${requiredIncome.toFixed(
          2
        )}).`
      );
    } else {
      passedChecks++;
    }
  }

  // Eviction history
  checks++;
  const eviction = parseYesNo(answers.evictionHistory);
  if (eviction === true && !property.allowsEvictionHistory) {
    failReasons.push("This property does not accept applicants with a prior eviction.");
  } else {
    passedChecks++;
  }

  // Background check consent
  if (property.requiresBackgroundCheck) {
    checks++;
    const consent = parseYesNo(answers.consentBackgroundCheck);
    if (consent !== true) {
      failReasons.push("Consent to a background check is required for this property.");
    } else {
      passedChecks++;
    }
  }

  const score = checks === 0 ? 100 : Math.round((passedChecks / checks) * 100);

  return {
    status: failReasons.length === 0 ? "PASSED" : "FAILED",
    score,
    failReasons,
    missingKeys: [],
  };
}
