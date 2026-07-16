import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Self-registration is intentionally restricted to the roles a member of the
 * public can legitimately claim. Staff/administrator roles can only be
 * granted by an existing administrator (see UsersService.changeRole).
 */
export const SELF_SERVICE_ROLES = [
  Role.PROSPECTIVE_TENANT,
  Role.LANDLORD,
  Role.PROPERTY_MANAGER,
] as const;

export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsIn(SELF_SERVICE_ROLES, {
    message: 'role must be one of PROSPECTIVE_TENANT, LANDLORD, PROPERTY_MANAGER',
  })
  role!: SelfServiceRole;
}
