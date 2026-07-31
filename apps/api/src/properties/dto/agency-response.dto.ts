export class AgencyResponseDto {
  id!: string;
  displayName!: string;
  managedPropertyCount!: number;

  static from(agency: { id: string; displayName: string; managedPropertyCount: number }): AgencyResponseDto {
    const dto = new AgencyResponseDto();
    dto.id = agency.id;
    dto.displayName = agency.displayName;
    dto.managedPropertyCount = agency.managedPropertyCount;
    return dto;
  }
}
