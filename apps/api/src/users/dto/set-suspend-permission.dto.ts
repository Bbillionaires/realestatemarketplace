import { IsBoolean } from 'class-validator';

export class SetSuspendPermissionDto {
  @IsBoolean()
  enabled!: boolean;
}
