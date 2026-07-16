import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Marks a route/controller as requiring one of the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
