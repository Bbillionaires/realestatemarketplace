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
  createdAt!: Date;
  lastLoginAt!: Date | null;
  profile!: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string;
    locale: string;
  } | null;

  static from(user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
    profile?: {
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
      timezone: string;
      locale: string;
    } | null;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    dto.lastLoginAt = user.lastLoginAt;
    dto.profile = user.profile
      ? {
          displayName: user.profile.displayName,
          avatarUrl: user.profile.avatarUrl,
          bio: user.profile.bio,
          timezone: user.profile.timezone,
          locale: user.profile.locale,
        }
      : null;
    return dto;
  }
}
