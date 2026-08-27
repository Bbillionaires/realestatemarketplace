import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getOrCreateMine(user);
  }

  @Post('checkout')
  @AuditLog('subscription.checkout', 'LandlordSubscription')
  createCheckout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionCheckoutDto) {
    return this.subscriptionsService.createCheckout(user, dto.tier);
  }
}
