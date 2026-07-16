import { maskPhoneNumber } from '../../common/utils/phone.util';

/**
 * The only shape a PhoneNumber row is ever allowed to leave the API as.
 * `encryptedNumber` and `numberHash` never appear in any response.
 */
export class PhoneNumberResponseDto {
  id!: string;
  maskedNumber!: string;
  countryCode!: string;
  isVerified!: boolean;
  isPrimary!: boolean;
  verifiedAt!: Date | null;
  createdAt!: Date;

  static from(row: {
    id: string;
    last4: string;
    countryCode: string;
    isVerified: boolean;
    isPrimary: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
  }): PhoneNumberResponseDto {
    const dto = new PhoneNumberResponseDto();
    dto.id = row.id;
    dto.maskedNumber = maskPhoneNumber(`000000000${row.last4}`);
    dto.countryCode = row.countryCode;
    dto.isVerified = row.isVerified;
    dto.isPrimary = row.isPrimary;
    dto.verifiedAt = row.verifiedAt;
    dto.createdAt = row.createdAt;
    return dto;
  }
}
