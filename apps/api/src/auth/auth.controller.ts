import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function requestContext(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// @Throttle is evaluated when this module is first imported (before Nest's
// DI container exists), so it can't be resolved via ConfigService — it
// reads process.env directly instead. main.ts loads dotenv before
// importing AppModule specifically to make this env var available in time.
const AUTH_RATE_LIMIT_PER_MIN = parseInt(process.env.AUTH_RATE_LIMIT_PER_MIN ?? '10', 10);

@Controller('auth')
@Throttle({ default: { limit: AUTH_RATE_LIMIT_PER_MIN, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, requestContext(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    return this.authService.login(user.id, requestContext(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, requestContext(req));
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  // Always responds the same way regardless of whether the email matches an
  // account, so a caller can't use this to probe which emails are registered.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto.email, requestContext(req));
    return { message: "If an account exists for that email, we've sent a password reset link." };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(dto.token, dto.newPassword, requestContext(req));
    return { message: 'Your password has been reset. You can now sign in.' };
  }
}
