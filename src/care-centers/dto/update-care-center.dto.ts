import { PartialType } from '@nestjs/mapped-types';
import { CreateCareCenterDto } from './create-care-center.dto';

export class UpdateCareCenterDto extends PartialType(CreateCareCenterDto) {}
