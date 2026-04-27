import { PartialType } from '@nestjs/mapped-types';
import { CreatePathologyDto } from './create-pathology.dto';

export class UpdatePathologyDto extends PartialType(CreatePathologyDto) {}
