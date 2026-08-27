import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { RentEstimateQueryDto } from './dto/rent-estimate-query.dto';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @AuditLog('property.create', 'Property')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('type') propertyType?: string,
    @Query('section8') section8?: string,
    @Query('secondChance') secondChance?: string,
    @Query('roomRentals') roomRentals?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.propertiesService.findAll(user, {
      city,
      state,
      propertyType,
      acceptsSection8Vouchers: section8 === 'true' ? true : undefined,
      secondChanceFriendly: secondChance === 'true' ? true : undefined,
      roomRentals: roomRentals === 'true' ? true : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('agencies')
  listAgencies() {
    return this.propertiesService.listAgencies();
  }

  // Public — the home page's flip-card feed is a logged-out visitor's first
  // look at the platform, so it can't require a JWT the way every other
  // /properties route does.
  @Get('feed')
  @Public()
  getFeed(@Query('take') take?: string) {
    const parsed = take ? parseInt(take, 10) : 12;
    const bounded = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 12;
    return this.propertiesService.getFeed(bounded);
  }

  @Get('rent-estimate')
  rentEstimate(@Query() query: RentEstimateQueryDto) {
    return this.propertiesService.estimateRent(query);
  }

  @Get('waitlists/me')
  myWaitlists(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.listMyWaitlistEntries(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.propertiesService.findOne(user, id);
  }

  @Patch(':id')
  @AuditLog('property.update', 'Property')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(user, id, dto);
  }

  // Public, same reasoning as GET /feed — this fires when a logged-out
  // visitor flips a feed card, well before any login.
  @Post(':id/view')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  recordView(@Param('id') id: string) {
    return this.propertiesService.recordView(id);
  }

  @Post(':id/managers')
  @AuditLog('property.assign_manager', 'Property')
  assignManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.propertiesService.assignManager(user, id, dto.userId);
  }

  @Patch(':id/managers/:userId/revoke')
  @AuditLog('property.revoke_manager', 'Property')
  revokeManager(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.propertiesService.revokeManager(user, id, userId);
  }

  @Get(':id/units')
  listUnits(@Param('id') id: string) {
    return this.propertiesService.listUnits(id);
  }

  @Get(':id/schools')
  listNearbySchools(@Param('id') id: string) {
    return this.propertiesService.listNearbySchools(id);
  }

  @Post(':id/schools/refresh')
  @AuditLog('property.refresh_schools', 'Property')
  refreshSchools(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.propertiesService.refreshSchools(user, id);
  }

  @Post(':id/units')
  @AuditLog('property.create_unit', 'PropertyUnit')
  createUnit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateUnitDto) {
    return this.propertiesService.createUnit(user, id, dto);
  }

  @Patch(':id/units/:unitId')
  @AuditLog('property.update_unit', 'PropertyUnit')
  updateUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('unitId') unitId: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.propertiesService.updateUnit(user, id, unitId, dto);
  }

  @Get(':id/units/:unitId/beds')
  listBeds(@Param('id') id: string, @Param('unitId') unitId: string) {
    return this.propertiesService.listBeds(id, unitId);
  }

  @Post(':id/units/:unitId/beds')
  @AuditLog('property.create_bed', 'Bed')
  createBed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('unitId') unitId: string,
    @Body() dto: CreateBedDto,
  ) {
    return this.propertiesService.createBed(user, id, unitId, dto);
  }

  @Patch(':id/units/:unitId/beds/:bedId')
  @AuditLog('property.update_bed', 'Bed')
  updateBed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('unitId') unitId: string,
    @Param('bedId') bedId: string,
    @Body() dto: UpdateBedDto,
  ) {
    return this.propertiesService.updateBed(user, id, unitId, bedId, dto);
  }

  @Post(':id/waitlist')
  @AuditLog('property.waitlist_join', 'Property')
  joinWaitlist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: JoinWaitlistDto) {
    return this.propertiesService.joinWaitlist(user, id, dto.note);
  }

  @Delete(':id/waitlist')
  @AuditLog('property.waitlist_leave', 'Property')
  leaveWaitlist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.propertiesService.leaveWaitlist(user, id);
  }

  @Get(':id/waitlist')
  listWaitlist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.propertiesService.listWaitlist(user, id);
  }
}
