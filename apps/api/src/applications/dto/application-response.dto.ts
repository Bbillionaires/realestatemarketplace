import { ApplicationStatus } from '@prisma/client';

export interface ApplicationOccupantView {
  id: string;
  name: string;
  relationship: string | null;
}

export interface ApplicationRentalHistoryEntryView {
  id: string;
  addressLine1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  landlordName: string | null;
  landlordPhone: string | null;
  landlordEmail: string | null;
  monthlyRentCents: number | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  reasonForLeaving: string | null;
}

export interface ApplicationReferenceView {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Never carries `incomeProofFile` bytes — only the dedicated download
 * handler ever selects that column. No SSN field exists anywhere on
 * `Application`, so there is nothing to accidentally leak here either.
 */
export class ApplicationResponseDto {
  id!: string | null;
  conversationId!: string;
  status!: ApplicationStatus | null;
  submittedAt!: Date | null;
  decisionAt!: Date | null;
  decisionBy!: string | null;
  notes!: string | null;

  fullLegalName!: string | null;
  dateOfBirth!: string | null;
  contactPhone!: string | null;
  contactEmail!: string | null;
  currentAddressLine1!: string | null;
  currentAddressLine2!: string | null;
  currentCity!: string | null;
  currentState!: string | null;
  currentZip!: string | null;

  employerName!: string | null;
  employerPhone!: string | null;
  position!: string | null;
  employmentStartDate!: string | null;
  monthlyIncomeCents!: number | null;
  otherIncomeCents!: number | null;
  otherIncomeNote!: string | null;
  incomeProofFileName!: string | null;

  reasonForMoving!: string | null;

  hasPets!: boolean;
  petDetails!: string | null;
  hasVehicles!: boolean;
  vehicleDetails!: string | null;

  hasGuarantor!: boolean;
  guarantorFullName!: string | null;
  guarantorPhone!: string | null;
  guarantorEmail!: string | null;
  guarantorMonthlyIncomeCents!: number | null;

  feeCents!: number | null;
  checkoutUrl!: string | null;
  paidAt!: Date | null;

  occupants!: ApplicationOccupantView[];
  rentalHistory!: ApplicationRentalHistoryEntryView[];
  references!: ApplicationReferenceView[];

  createdAt!: Date | null;

  static from(row: {
    id: string;
    conversationId: string;
    status: ApplicationStatus;
    submittedAt: Date | null;
    decisionAt: Date | null;
    decisionBy: string | null;
    notes: string | null;
    fullLegalName: string | null;
    dateOfBirth: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    currentAddressLine1: string | null;
    currentAddressLine2: string | null;
    currentCity: string | null;
    currentState: string | null;
    currentZip: string | null;
    employerName: string | null;
    employerPhone: string | null;
    position: string | null;
    employmentStartDate: string | null;
    monthlyIncomeCents: number | null;
    otherIncomeCents: number | null;
    otherIncomeNote: string | null;
    incomeProofFileName: string | null;
    reasonForMoving: string | null;
    hasPets: boolean;
    petDetails: string | null;
    hasVehicles: boolean;
    vehicleDetails: string | null;
    hasGuarantor: boolean;
    guarantorFullName: string | null;
    guarantorPhone: string | null;
    guarantorEmail: string | null;
    guarantorMonthlyIncomeCents: number | null;
    feeCents: number | null;
    checkoutUrl: string | null;
    paidAt: Date | null;
    occupants: { id: string; name: string; relationship: string | null }[];
    rentalHistory: {
      id: string;
      addressLine1: string;
      city: string | null;
      state: string | null;
      zip: string | null;
      landlordName: string | null;
      landlordPhone: string | null;
      landlordEmail: string | null;
      monthlyRentCents: number | null;
      moveInDate: string | null;
      moveOutDate: string | null;
      reasonForLeaving: string | null;
    }[];
    references: { id: string; name: string; relationship: string | null; phone: string | null; email: string | null }[];
    createdAt: Date;
  }): ApplicationResponseDto {
    const dto = new ApplicationResponseDto();
    dto.id = row.id;
    dto.conversationId = row.conversationId;
    dto.status = row.status;
    dto.submittedAt = row.submittedAt;
    dto.decisionAt = row.decisionAt;
    dto.decisionBy = row.decisionBy;
    dto.notes = row.notes;
    dto.fullLegalName = row.fullLegalName;
    dto.dateOfBirth = row.dateOfBirth;
    dto.contactPhone = row.contactPhone;
    dto.contactEmail = row.contactEmail;
    dto.currentAddressLine1 = row.currentAddressLine1;
    dto.currentAddressLine2 = row.currentAddressLine2;
    dto.currentCity = row.currentCity;
    dto.currentState = row.currentState;
    dto.currentZip = row.currentZip;
    dto.employerName = row.employerName;
    dto.employerPhone = row.employerPhone;
    dto.position = row.position;
    dto.employmentStartDate = row.employmentStartDate;
    dto.monthlyIncomeCents = row.monthlyIncomeCents;
    dto.otherIncomeCents = row.otherIncomeCents;
    dto.otherIncomeNote = row.otherIncomeNote;
    dto.incomeProofFileName = row.incomeProofFileName;
    dto.reasonForMoving = row.reasonForMoving;
    dto.hasPets = row.hasPets;
    dto.petDetails = row.petDetails;
    dto.hasVehicles = row.hasVehicles;
    dto.vehicleDetails = row.vehicleDetails;
    dto.hasGuarantor = row.hasGuarantor;
    dto.guarantorFullName = row.guarantorFullName;
    dto.guarantorPhone = row.guarantorPhone;
    dto.guarantorEmail = row.guarantorEmail;
    dto.guarantorMonthlyIncomeCents = row.guarantorMonthlyIncomeCents;
    dto.feeCents = row.feeCents;
    dto.checkoutUrl = row.checkoutUrl;
    dto.paidAt = row.paidAt;
    dto.occupants = row.occupants.map((o) => ({ id: o.id, name: o.name, relationship: o.relationship }));
    dto.rentalHistory = row.rentalHistory.map((r) => ({
      id: r.id,
      addressLine1: r.addressLine1,
      city: r.city,
      state: r.state,
      zip: r.zip,
      landlordName: r.landlordName,
      landlordPhone: r.landlordPhone,
      landlordEmail: r.landlordEmail,
      monthlyRentCents: r.monthlyRentCents,
      moveInDate: r.moveInDate,
      moveOutDate: r.moveOutDate,
      reasonForLeaving: r.reasonForLeaving,
    }));
    dto.references = row.references.map((r) => ({
      id: r.id,
      name: r.name,
      relationship: r.relationship,
      phone: r.phone,
      email: r.email,
    }));
    dto.createdAt = row.createdAt;
    return dto;
  }

  /** No application started yet for this conversation. */
  static none(conversationId: string): ApplicationResponseDto {
    const dto = new ApplicationResponseDto();
    dto.id = null;
    dto.conversationId = conversationId;
    dto.status = null;
    dto.submittedAt = null;
    dto.decisionAt = null;
    dto.decisionBy = null;
    dto.notes = null;
    dto.fullLegalName = null;
    dto.dateOfBirth = null;
    dto.contactPhone = null;
    dto.contactEmail = null;
    dto.currentAddressLine1 = null;
    dto.currentAddressLine2 = null;
    dto.currentCity = null;
    dto.currentState = null;
    dto.currentZip = null;
    dto.employerName = null;
    dto.employerPhone = null;
    dto.position = null;
    dto.employmentStartDate = null;
    dto.monthlyIncomeCents = null;
    dto.otherIncomeCents = null;
    dto.otherIncomeNote = null;
    dto.incomeProofFileName = null;
    dto.reasonForMoving = null;
    dto.hasPets = false;
    dto.petDetails = null;
    dto.hasVehicles = false;
    dto.vehicleDetails = null;
    dto.hasGuarantor = false;
    dto.guarantorFullName = null;
    dto.guarantorPhone = null;
    dto.guarantorEmail = null;
    dto.guarantorMonthlyIncomeCents = null;
    dto.feeCents = null;
    dto.checkoutUrl = null;
    dto.paidAt = null;
    dto.occupants = [];
    dto.rentalHistory = [];
    dto.references = [];
    dto.createdAt = null;
    return dto;
  }
}
