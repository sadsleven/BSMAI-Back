import { PartialType } from '@nestjs/mapped-types';
import { CreateTaxUnitDto } from './create-tax-unit.dto';

export class UpdateTaxUnitDto extends PartialType(CreateTaxUnitDto) {}
