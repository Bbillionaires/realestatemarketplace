import { Role } from '@prisma/client';

/**
 * The ONLY shape a User is ever allowed to leave the API as. There is no
 * code path that serializes a raw Prisma User (which would include
 * passwordHash, twoFactorSecret, etc). Phone numbers are never included
 * here at all — see PhoneModule for masked phone exposure.
 */
export class UserResponseDto {
  id!: string;
  email!: string;
  role!: Role;
  isActive!: boolean;
  /** Only meaningful for STAFF_MODERATOR — see User.canSuspendUsers. */
  canSuspendUsers!: boolean;
  createdAt!: Date;
  lastLoginAt!: Date | null;
  profile!: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string;
    locale: string;
    hasLawnCareProvider: boolean;
    hasPlumbingProvider: boolean;
    hasHandymanProvider: boolean;
    hasPestControlProvider: boolean;
    hasRoofingProvider: boolean;
    requestsPropertyManagementHelp: boolean;
  } | null;

  static from(user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    canSuspendUsers: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
    profile?: {
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
      timezone: string;
      locale: string;
      hasLawnCareProvider: boolean;
      hasPlumbingProvider: boolean;
      hasHandymanProvider: boolean;
      hasPestControlProvider: boolean;
      hasRoofingProvider: boolean;
      requestsPropertyManagementHelp: boolean;
    } | null;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.canSuspendUsers = user.canSuspendUsers;
    dto.createdAt = user.createdAt;
    dto.lastLoginAt = user.lastLoginAt;
    dto.profile = user.profile
      ? {
          displayName: user.profile.displayName,
          avatarUrl: user.profile.avatarUrl,
          bio: user.profile.bio,
          timezone: user.profile.timezone,
          locale: user.profile.locale,
          hasLawnCareProvider: user.profile.hasLawnCareProvider,
          hasPlumbingProvider: user.profile.hasPlumbingProvider,
          hasHandymanProvider: user.profile.hasHandymanProvider,
          hasPestControlProvider: user.profile.hasPestControlProvider,
          hasRoofingProvider: user.profile.hasRoofingProvider,
          requestsPropertyManagementHelp: user.profile.requestsPropertyManagementHelp,
        }
      : null;
    return dto;
  }
}
