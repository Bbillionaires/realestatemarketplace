import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PhoneService } from './phone.service';
import { StartVerificationDto } from './dto/start-verification.dto';
import { ConfirmVerificationDto } from './dto/confirm-verification.dto';

@Controller('phone')
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.phoneService.listForUser(user.id);
  }

  @Post('start-verification')
  @HttpCode(HttpStatus.OK)
  startVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartVerificationDto,
    @Req() req: Request,
  ) {
    return this.phoneService.startVerification(user.id, dto.phoneNumber, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('confirm-verification')
  @HttpCode(HttpStatus.OK)
  @AuditLog('phone.verified', 'PhoneNumber')
  confirmVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmVerificationDto,
    @Req() req: Request,
  ) {
    return this.phoneService.confirmVerification(user.id, dto.phoneNumber, dto.code, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
