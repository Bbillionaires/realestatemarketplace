import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { ProgressResponseDto } from './dto/progress-response.dto';

const TENANT_ROLES: Role[] = [Role.PROSPECTIVE_TENANT, Role.CURRENT_TENANT];
const PROGRESS_INCLUDE = { completions: true } as const;

@Injectable()
export class HomeownershipProgressService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenant(actor: AuthenticatedUser): void {
    if (!TENANT_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Only tenants have a homeownership progress tracker');
    }
  }

  /** No write on read — a tenant who's never touched their tracker gets an empty shape. */
  async getMine(actor: AuthenticatedUser): Promise<ProgressResponseDto> {
    this.assertTenant(actor);
    const progress = await this.prisma.homeownershipProgress.findUnique({
      where: { tenantId: actor.id },
      include: PROGRESS_INCLUDE,
    });
    return progress ? ProgressResponseDto.from(progress) : ProgressResponseDto.empty();
  }

  /** Lazily creates the progress row on the tenant's first real update. */
  async updateMine(actor: AuthenticatedUser, dto: UpdateProgressDto): Promise<ProgressResponseDto> {
    this.assertTenant(actor);
    const progress = await this.prisma.homeownershipProgress.upsert({
      where: { tenantId: actor.id },
      create: { tenantId: actor.id, ...dto },
      update: { ...dto },
      include: PROGRESS_INCLUDE,
    });
    return ProgressResponseDto.from(progress);
  }

  async markMilestoneComplete(actor: AuthenticatedUser, milestoneId: string): Promise<ProgressResponseDto> {
    this.assertTenant(actor);
    const milestone = await this.prisma.homeownershipMilestone.findFirst({ where: { id: milestoneId, isActive: true } });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const progress = await this.prisma.homeownershipProgress.upsert({
      where: { tenantId: actor.id },
      create: { tenantId: actor.id },
      update: {},
    });
    await this.prisma.homeownershipMilestoneCompletion.upsert({
      where: { progressId_milestoneId: { progressId: progress.id, milestoneId } },
      create: { progressId: progress.id, milestoneId },
      update: {},
    });

    return this.getMine(actor);
  }

  async unmarkMilestoneComplete(actor: AuthenticatedUser, milestoneId: string): Promise<ProgressResponseDto> {
    this.assertTenant(actor);
    const progress = await this.prisma.homeownershipProgress.findUnique({ where: { tenantId: actor.id } });
    if (progress) {
      await this.prisma.homeownershipMilestoneCompletion.deleteMany({ where: { progressId: progress.id, milestoneId } });
    }
    return this.getMine(actor);
  }
}
