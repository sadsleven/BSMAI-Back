import { Controller, Get } from '@nestjs/common';
import { BanksService } from './banks.service';

/**
 * Catálogo de bancos venezolanos para Pago Móvil. Read-only (gestionado por seed).
 * Sólo requiere JWT — no necesita permiso RBAC porque se usa para popular selects en formularios.
 */
@Controller('banks')
export class BanksController {
  constructor(private readonly service: BanksService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
