import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JobReferralStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateJobReferralDto } from './dto/create-job-referral.dto';
import { JobReferralResponseDto } from './dto/job-referral-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const OWN_TENANT_SCOPED_ROLES: Role[] = [Role.LANDLORD, Role.PROPERTY_MANAGER];
const PLATFORM_ROLES: Role[] = [Role.ADMINISTRATOR, Role.SUPER_ADMINISTRATOR];

const REFERRAL_INCLUDE = {
  poster: { select: { profile: { select: { displayName: true } } } },
} as const;

/**
 * Word of a real, external job opening a landlord/manager/admin has no
 * control over and isn't paying for — deliberately kept separate from
 * GigJob (which involves real money and the poster's own liability for the
 * work site). Visibility scoping mirrors GigJob exactly (own tenants via
 * an existing Conversation, or platform-wide for admins) since the
 * "who should see this" question is the same; nothing else about it is.
 */
@Injectable()
export class JobReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthenticatedUser, dto: CreateJobReferralDto): Promise<JobReferralResponseDto> {
    if (!OWN_TENANT_SCOPED_ROLES.includes(actor.role) && !PLATFORM_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only landlords, property managers, or admins can post a job referral');
    }

    const referral = await this.prisma.jobReferral.create({
      data: {
        posterId: actor.id,
        posterRole: actor.role,
        title: dto.title,
        employerName: dto.employerName,
        location: dto.location,
        applyUrl: dto.applyUrl,
        contactInfo: dto.contactInfo,
        description: dto.description,
      },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(referral);
  }

  async listVisibleToTenant(actor: AuthenticatedUser): Promise<JobReferralResponseDto[]> {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants can browse job referrals');
    }

    const myConversations = await this.prisma.conversation.findMany({
      where: { tenantId: actor.id },
      select: { landlordId: true },
      distinct: ['landlordId'],
    });
    const myLandlordIds = myConversations.map((c) => c.landlordId);

    const referrals = await this.prisma.jobReferral.findMany({
      where: {
        status: JobReferralStatus.ACTIVE,
        OR: [{ posterRole: { in: PLATFORM_ROLES } }, { posterId: { in: myLandlordIds } }],
      },
      include: REFERRAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return referrals.map((r) => JobReferralResponseDto.from(r));
  }

  async listPosted(actor: AuthenticatedUser): Promise<JobReferralResponseDto[]> {
    const referrals = await this.prisma.jobReferral.findMany({
      where: { posterId: actor.id },
      include: REFERRAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return referrals.map((r) => JobReferralResponseDto.from(r));
  }

  async close(actor: AuthenticatedUser, id: string): Promise<JobReferralResponseDto> {
    const referral = await this.prisma.jobReferral.findUnique({ where: { id } });
    if (!referral) {
      throw new NotFoundException('Job referral not found');
    }
    if (referral.posterId !== actor.id) {
      throw new ForbiddenException('Only the poster can close this job referral');
    }
    if (referral.status !== JobReferralStatus.ACTIVE) {
      throw new BadRequestException('This job referral is already closed');
    }

    const updated = await this.prisma.jobReferral.update({
      where: { id },
      data: { status: JobReferralStatus.CLOSED, closedAt: new Date() },
      include: REFERRAL_INCLUDE,
    });
    return JobReferralResponseDto.from(updated);
  }
}
