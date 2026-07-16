import { IsString, IsUUID } from 'class-validator';

export class AssignManagerDto {
  @IsUUID()
  userId!: string;
}

export class RevokeManagerParams {
  @IsString()
  propertyId!: string;

  @IsString()
  userId!: string;
}
