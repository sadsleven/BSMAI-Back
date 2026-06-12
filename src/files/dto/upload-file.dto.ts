import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FILE_OWNER_TYPES } from '../files.constants';

/** Campos `text` del multipart. El binario va en `file`. */
export class UploadFileDto {
  @IsIn(FILE_OWNER_TYPES)
  ownerType: (typeof FILE_OWNER_TYPES)[number];

  @IsUUID()
  ownerId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  kind?: string | null;
}
