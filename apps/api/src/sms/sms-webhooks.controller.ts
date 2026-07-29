import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuditService } from '../audit/audit.service';
import { MessagesService } from '../messages/messages.service';
import { SmsRoutingService } from './sms-routing.service';
import { SMS_PROVIDER } from './sms.constants';
import { SmsProvider } from './interfaces/sms-provider.interface';
import { InboundSmsWebhookDto } from './dto/inbound-sms-webhook.dto';
import { DeliveryStatusWebhookDto } from './dto/delivery-status-webhook.dto';

/**
 * Inbound/delivery-status webhooks are unauthenticated by JWT (the carrier,
 * not a logged-in user, calls these) — trust instead comes from
 * SmsProvider.validateWebhook, which verifies the carrier's signature. The
 * mock provider always returns true since there's no real carrier secret in
 * local dev/test; TwilioProvider's real signature check drops in here
 * unchanged when Twilio/Telnyx are wired up.
 */
@Controller('sms/webhooks')
@Public()
export class SmsWebhooksController {
  constructor(
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly routingService: SmsRoutingService,
    private readonly messagesService: MessagesService,
    private readonly auditService: AuditService,
  ) {}

  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async inbound(
    @Body() body: InboundSmsWebhookDto,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Req() req: Request,
  ) {
    const valid = this.smsProvider.validateWebhook({
      signature: signature ?? '',
      url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      rawBody: JSON.stringify(body),
    });
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const parsed = this.smsProvider.parseInboundMessage(body);

    const routing = await this.routingService.route(parsed);

    if (routing.outcome === 'not_found') {
      await this.auditService.log({
        action: 'sms.inbound_unroutable',
        entityType: 'RelayNumber',
        metadata: { to: parsed.to },
      });
      return { status: 'unroutable' };
    }

    if (routing.outcome === 'menu_sent') {
      return { status: 'menu_sent' };
    }

    await this.messagesService.ingestInbound({
      conversationId: routing.conversationId,
      senderId: routing.senderUserId,
      body: routing.body,
      providerMessageId: routing.providerMessageId,
    });

    return { status: 'processed' };
  }

  @Post('delivery-status')
  @HttpCode(HttpStatus.OK)
  async deliveryStatus(@Body() body: DeliveryStatusWebhookDto) {
    const parsed = this.smsProvider.parseDeliveryStatus(body);
    await this.messagesService.recordDeliveryStatus(parsed);
    return { status: 'ok' };
  }
}
