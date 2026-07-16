import { z } from "zod";

export const RoleValues = ["LANDLORD", "TENANT", "PROPERTY_MANAGER"] as const;

export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Contain at least one letter.")
    .regex(/[0-9]/, "Contain at least one number."),
  role: z.enum(RoleValues, "Choose an account type."),
});

export type SignupState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;

export const LoginSchema = z.object({
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export type LoginState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export const UtilityTypeValues = [
  "ELECTRIC",
  "GAS",
  "WATER",
  "SEWER",
  "TRASH",
  "INTERNET",
  "CABLE",
  "OTHER",
] as const;

export const PaidByValues = ["LANDLORD", "TENANT", "SPLIT"] as const;
export const LawnCarePartyValues = [
  "LANDLORD",
  "TENANT",
  "PROPERTY_MANAGER",
  "HIRED_SERVICE",
] as const;
export const LateFeeTypeValues = ["FLAT", "PERCENTAGE"] as const;

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), schema.optional());

export const PropertySchema = z.object({
  title: z.string().trim().min(3, "Title is required."),
  description: z.string().trim().min(10, "Description is required."),

  addressLine1: z.string().trim().min(1, "Street address is required."),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(2, "State is required.").max(2, "Use a 2-letter state code."),
  zip: z.string().trim().min(5, "ZIP code is required."),

  bedrooms: z.preprocess((v) => Number(v), z.number().int().min(0)),
  bathrooms: z.preprocess((v) => Number(v), z.number().min(0)),
  squareFeet: optionalNumber(z.number().int().min(0)),

  rentAmount: z.preprocess((v) => Number(v), z.number().positive("Rent must be greater than 0.")),
  securityDeposit: z.preprocess((v) => Number(v), z.number().min(0)),
  leaseLengthMonths: z.preprocess((v) => Number(v), z.number().int().positive()),
  leaseTermNotes: z.string().trim().optional(),
  rentDueDay: z.preprocess((v) => Number(v), z.number().int().min(1).max(31)),

  acceptsHud: z.preprocess((v) => v === "on" || v === "true", z.boolean()),

  minCreditScore: optionalNumber(z.number().int().min(300).max(900)),
  minMonthlyIncomeMultiple: optionalNumber(z.number().positive()),
  requiresBackgroundCheck: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  allowsEvictionHistory: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  criteriaNotes: z.string().trim().optional(),

  lawnCareResponsibleParty: z.enum(LawnCarePartyValues),
  lawnCarePaidBy: z.enum(PaidByValues),

  lateFeeAmount: optionalNumber(z.number().min(0)),
  lateFeeType: z.enum(LateFeeTypeValues),
  lateFeeGraceDays: z.preprocess((v) => Number(v || 0), z.number().int().min(0)),

  workForRentAvailable: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  workForRentDescription: z.string().trim().optional(),

  managerEmail: z
    .preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  ownerEmail: z
    .preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
});

export type PropertyFormState =
  | {
      errors?: Partial<Record<keyof z.infer<typeof PropertySchema>, string[]>>;
      message?: string;
    }
  | undefined;
