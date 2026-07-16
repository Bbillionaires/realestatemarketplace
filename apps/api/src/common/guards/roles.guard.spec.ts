import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: Role.PROSPECTIVE_TENANT }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: Role.ADMINISTRATOR }))).toBe(true);
  });

  it('denies access when the user lacks the required role', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ role: Role.LANDLORD }))).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user', () => {
    const reflector = { getAllAndOverride: () => [Role.ADMINISTRATOR] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
