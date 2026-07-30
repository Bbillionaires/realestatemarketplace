import { Role } from '@prisma/client';

/**
 * Shape attached to `request.user` after JWT validation. Deliberately
 * minimal — the JWT payload only carries `sub` (user id); role is always
 * re-read from the database on each request (see JwtStrategy) so a
 * compromised-but-not-yet-expired token cannot be used after a role change
 * or account suspension.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  /** Only meaningful for STAFF_MODERATOR — see User.canSuspendUsers. */
  canSuspendUsers: boolean;
}
