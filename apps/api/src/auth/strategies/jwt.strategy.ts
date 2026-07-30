import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true })!.accessSecret,
    });
  }

  /**
   * Role and active-status are re-read from the database on every request
   * rather than trusted from the token payload, so a suspension or role
   * change takes effect immediately instead of waiting for token expiry.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been suspended');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      canSuspendUsers: user.canSuspendUsers,
    };
  }
}
