import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestoneResponseDto } from './dto/milestone-response.dto';

@Injectable()
export class HomeownershipMilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  /** For the tenant-facing tracker — active milestones only, in display order. */
  async listActive(): Promise<MilestoneResponseDto[]> {
    const milestones = await this.prisma.homeownershipMilestone.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return milestones.map((m) => MilestoneResponseDto.from(m));
  }

  /** For the admin screen — every milestone, including inactive ones. */
  async listAll(): Promise<MilestoneResponseDto[]> {
    const milestones = await this.prisma.homeownershipMilestone.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return milestones.map((m) => MilestoneResponseDto.from(m));
  }

  async create(dto: CreateMilestoneDto): Promise<MilestoneResponseDto> {
    const milestone = await this.prisma.homeownershipMilestone.create({
      data: { label: dto.label, sortOrder: dto.sortOrder ?? 0 },
    });
    return MilestoneResponseDto.from(milestone);
  }

  async update(id: string, dto: UpdateMilestoneDto): Promise<MilestoneResponseDto> {
    await this.assertExists(id);
    const milestone = await this.prisma.homeownershipMilestone.update({ where: { id }, data: { ...dto } });
    return MilestoneResponseDto.from(milestone);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    // Cascades HomeownershipMilestoneCompletion rows — a removed milestone
    // definition has no meaning to preserve, unlike every other admin
    // resource in this app which soft-deletes/revokes instead.
    await this.prisma.homeownershipMilestone.delete({ where: { id } });
  }

  private async assertExists(id: string): Promise<void> {
    const milestone = await this.prisma.homeownershipMilestone.findUnique({ where: { id } });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }
  }
}
