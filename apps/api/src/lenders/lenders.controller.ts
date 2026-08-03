import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { LendersService } from './lenders.service';
import { CreateLenderAssignmentDto } from './dto/create-lender-assignment.dto';
import { UpdateLenderAssignmentDto } from './dto/update-lender-assignment.dto';
import { CreateLenderRequestDto } from './dto/create-lender-request.dto';
import { SubmitLenderRequestDto } from './dto/submit-lender-request.dto';

const ADMIN_ROLES = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];
const TENANT_ROLES = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];

@Controller('lenders')
export class LendersController {
  constructor(private readonly lendersService: LendersService) {}

  @Post('assignments')
  @Roles(...ADMIN_ROLES)
  @AuditLog('lender.assignment_create', 'LenderAssignment')
  createAssignment(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateLenderAssignmentDto) {
    return this.lendersService.createAssignment(dto, actor.id);
  }

  @Get('assignments')
  @Roles(...ADMIN_ROLES)
  listAssignments(@Query('propertyId') propertyId?: string, @Query('lenderId') lenderId?: string) {
    return this.lendersService.listAssignments({ propertyId, lenderId });
  }

  @Patch('assignments/:id')
  @Roles(...ADMIN_ROLES)
  @AuditLog('lender.assignment_update', 'LenderAssignment')
  updateAssignment(@Param('id') id: string, @Body() dto: UpdateLenderAssignmentDto) {
    return this.lendersService.updateAssignment(id, dto);
  }

  @Patch('assignments/:id/revoke')
  @Roles(...ADMIN_ROLES)
  @AuditLog('lender.assignment_revoke', 'LenderAssignment')
  revokeAssignment(@Param('id') id: string) {
    return this.lendersService.revokeAssignment(id);
  }

  @Get('assignments/me')
  @Roles(Role.LENDER)
  listMyAssignments(@CurrentUser() actor: AuthenticatedUser) {
    return this.lendersService.listMyAssignments(actor);
  }

  @Post('assignments/:id/requests')
  @Roles(Role.LENDER)
  @AuditLog('lender.request_create', 'LenderPaymentRequest')
  createRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') assignmentId: string,
    @Body() dto: CreateLenderRequestDto,
  ) {
    return this.lendersService.createRequest(actor, assignmentId, dto);
  }

  @Get('assignments/:id/requests')
  @Roles(Role.LENDER)
  listRequestsForAssignment(@CurrentUser() actor: AuthenticatedUser, @Param('id') assignmentId: string) {
    return this.lendersService.listRequestsForAssignment(actor, assignmentId);
  }

  @Get('requests/me')
  @Roles(...TENANT_ROLES)
  listMyRequests(@CurrentUser() actor: AuthenticatedUser) {
    return this.lendersService.listMyRequests(actor);
  }

  @Post('requests/:id/submit')
  @Roles(...TENANT_ROLES)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @AuditLog('lender.request_submit', 'LenderPaymentRequest')
  submitRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') requestId: string,
    @Body() dto: SubmitLenderRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.lendersService.submitRequest(
      actor,
      requestId,
      dto.responseNote,
      file ? { originalname: file.originalname, mimetype: file.mimetype, buffer: file.buffer } : undefined,
    );
  }

  @Patch('requests/:id/decline')
  @Roles(...TENANT_ROLES)
  @AuditLog('lender.request_decline', 'LenderPaymentRequest')
  declineRequest(@CurrentUser() actor: AuthenticatedUser, @Param('id') requestId: string) {
    return this.lendersService.declineRequest(actor, requestId);
  }
}
