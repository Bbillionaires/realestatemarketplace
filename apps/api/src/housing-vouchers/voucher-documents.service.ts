import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { VoucherDocumentResponseDto } from './dto/voucher-document-response.dto';
import { VoucherDocumentAdminSummaryDto } from './dto/voucher-document-admin-summary.dto';

export const ALLOWED_VOUCHER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const STAFF_ROLES: Role[] = [Role.STAFF_MODERATOR, Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

export interface UploadedVoucherFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface VoucherFile {
  fileName: string;
  mimeType: string;
  fileData: Buffer;
}

@Injectable()
export class VoucherDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenant(actor: AuthenticatedUser): void {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can upload a Housing Voucher');
    }
  }

  private assertStaff(actor: AuthenticatedUser): void {
    if (!STAFF_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Staff access required');
    }
  }

  async upsertMine(actor: AuthenticatedUser, file: UploadedVoucherFile): Promise<VoucherDocumentResponseDto> {
    this.assertTenant(actor);
    if (!ALLOWED_VOUCHER_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Upload a PDF or image file (JPEG, PNG, or WEBP)');
    }

    const doc = await this.prisma.voucherDocument.upsert({
      where: { tenantId: actor.id },
      create: { tenantId: actor.id, fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer },
      // uploadedAt's `@default(now())` only fires on insert — Prisma never
      // re-applies it on an update, so a replace must set it explicitly or
      // the displayed/sorted date would stay frozen at the first-ever upload.
      update: { fileName: file.originalname, mimeType: file.mimetype, fileData: file.buffer, uploadedAt: new Date() },
      select: { fileName: true, mimeType: true, uploadedAt: true },
    });
    return VoucherDocumentResponseDto.from(doc);
  }

  async getMineMetadata(actor: AuthenticatedUser): Promise<VoucherDocumentResponseDto> {
    this.assertTenant(actor);
    const doc = await this.prisma.voucherDocument.findUnique({
      where: { tenantId: actor.id },
      select: { fileName: true, mimeType: true, uploadedAt: true },
    });
    return doc ? VoucherDocumentResponseDto.from(doc) : VoucherDocumentResponseDto.none();
  }

  async getMineFile(actor: AuthenticatedUser): Promise<VoucherFile> {
    this.assertTenant(actor);
    return this.getFileByTenantId(actor.id);
  }

  /** Used by VoucherAccessRequestsService once it has confirmed the landlord's request is ACCEPTED. */
  async getFileByTenantId(tenantId: string): Promise<VoucherFile> {
    const doc = await this.prisma.voucherDocument.findUnique({
      where: { tenantId },
      select: { fileName: true, mimeType: true, fileData: true },
    });
    if (!doc) {
      throw new NotFoundException('No Housing Voucher on file');
    }
    return { fileName: doc.fileName, mimeType: doc.mimeType, fileData: Buffer.from(doc.fileData) };
  }

  async hasDocument(tenantId: string): Promise<boolean> {
    const doc = await this.prisma.voucherDocument.findUnique({ where: { tenantId }, select: { id: true } });
    return doc !== null;
  }

  async listForAdmin(actor: AuthenticatedUser): Promise<VoucherDocumentAdminSummaryDto[]> {
    this.assertStaff(actor);
    const docs = await this.prisma.voucherDocument.findMany({
      select: {
        tenantId: true,
        fileName: true,
        mimeType: true,
        uploadedAt: true,
        tenant: { select: { email: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    return docs.map((d) => VoucherDocumentAdminSummaryDto.from(d));
  }

  async getForAdminDownload(actor: AuthenticatedUser, tenantId: string): Promise<VoucherFile> {
    this.assertStaff(actor);
    return this.getFileByTenantId(tenantId);
  }
}
