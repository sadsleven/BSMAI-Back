import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { Bank } from '../banks/entities/bank.entity';
import { BANKS_SEED } from '../banks/banks.data';
import { PERMISSION_CATALOG, PERMISSIONS } from '../permissions/permissions.catalog';
import { PROVIDER_ROLE_NAME } from '../provider-accounts/provider-accounts.service';

const SUPER_ADMIN_ROLE = 'Super Admin';
const BCRYPT_ROUNDS = 10;

/** Permisos mínimos del rol Proveedor: listar órdenes + emitir su informe (Paso 3). */
const PROVIDER_ROLE_PERMISSIONS = [
  PERMISSIONS.ORDERS.LIST,
  PERMISSIONS.ORDERS.STAGE_REPORT,
  PERMISSIONS.FILES.LIST,
  PERMISSIONS.FILES.CREATE,
  PERMISSIONS.FILES.SOFT_DELETE,
];

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Permission) private readonly permsRepo: Repository<Permission>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
  ) {}

  async run(): Promise<void> {
    await this.seedPermissions();
    const role = await this.seedSuperAdminRole();
    await this.seedSuperAdminUser(role);
    await this.seedProviderRole();
    await this.seedBanks();
    this.logger.log('Seed completado');
  }

  /**
   * Rol del sistema para usuarios proveedores (doctores / centros). Solo puede
   * listar órdenes y emitir el informe (Paso 3) de las órdenes donde participa
   * (alcance por proveedor resuelto en OrdersService/FilesService). Idempotente.
   */
  private async seedProviderRole(): Promise<Role> {
    const perms = await this.permsRepo.find({
      where: { name: In(PROVIDER_ROLE_PERMISSIONS) },
    });
    let role = await this.rolesRepo.findOne({
      where: { name: PROVIDER_ROLE_NAME },
      relations: { permissions: true },
      withDeleted: true,
    });
    if (!role) {
      role = this.rolesRepo.create({
        name: PROVIDER_ROLE_NAME,
        description:
          'Acceso de proveedor: lista sus órdenes y emite el informe médico (Paso 3)',
        isSystem: true,
        isActive: true,
        permissions: perms,
      });
    } else {
      if (role.deletedAt) {
        await this.rolesRepo.restore(role.id);
        role.deletedAt = null;
      }
      role.description =
        role.description ??
        'Acceso de proveedor: lista sus órdenes y emite el informe médico (Paso 3)';
      role.isSystem = true;
      role.isActive = true;
      role.permissions = perms;
    }
    const saved = await this.rolesRepo.save(role);
    this.logger.log(
      `Rol Proveedor asegurado con ${perms.length}/${PROVIDER_ROLE_PERMISSIONS.length} permisos`,
    );
    return saved;
  }

  private async seedBanks(): Promise<void> {
    const existing = await this.banksRepo.find();
    const existingByCode = new Map(existing.map((b) => [b.code, b] as const));
    const toInsert: Bank[] = [];
    const toUpdate: Bank[] = [];

    for (const def of BANKS_SEED) {
      const found = existingByCode.get(def.codigo);
      if (!found) {
        toInsert.push(this.banksRepo.create({ code: def.codigo, name: def.nombre }));
      } else if (found.name !== def.nombre) {
        found.name = def.nombre;
        toUpdate.push(found);
      }
    }
    if (toInsert.length) await this.banksRepo.save(toInsert);
    if (toUpdate.length) await this.banksRepo.save(toUpdate);
    this.logger.log(
      `Bancos: insertados=${toInsert.length} actualizados=${toUpdate.length} total=${BANKS_SEED.length}`,
    );
  }

  private async seedPermissions(): Promise<Permission[]> {
    const existing = await this.permsRepo.find();
    const existingByName = new Map(existing.map((p) => [p.name, p] as const));
    const toInsert: Permission[] = [];
    const toUpdate: Permission[] = [];

    for (const def of PERMISSION_CATALOG) {
      const found = existingByName.get(def.name);
      if (!found) {
        toInsert.push(this.permsRepo.create(def));
      } else if (
        found.resource !== def.resource ||
        found.action !== def.action ||
        found.description !== def.description ||
        found.label !== def.label ||
        found.group !== def.group
      ) {
        found.resource = def.resource;
        found.action = def.action;
        found.description = def.description;
        found.label = def.label;
        found.group = def.group;
        toUpdate.push(found);
      }
    }
    if (toInsert.length) await this.permsRepo.save(toInsert);
    if (toUpdate.length) await this.permsRepo.save(toUpdate);
    this.logger.log(
      `Permisos: insertados=${toInsert.length} actualizados=${toUpdate.length} total catálogo=${PERMISSION_CATALOG.length}`,
    );
    return this.permsRepo.find();
  }

  private async seedSuperAdminRole(): Promise<Role> {
    const all = await this.permsRepo.find();
    let role = await this.rolesRepo.findOne({
      where: { name: SUPER_ADMIN_ROLE },
      relations: { permissions: true },
      withDeleted: true,
    });
    if (!role) {
      role = this.rolesRepo.create({
        name: SUPER_ADMIN_ROLE,
        description: 'Rol con todos los permisos del sistema',
        isSystem: true,
        isActive: true,
        permissions: all,
      });
    } else {
      if (role.deletedAt) {
        await this.rolesRepo.restore(role.id);
        role.deletedAt = null;
      }
      role.description = role.description ?? 'Rol con todos los permisos del sistema';
      role.isSystem = true;
      role.isActive = true;
      role.permissions = all;
    }
    return this.rolesRepo.save(role);
  }

  private async seedSuperAdminUser(role: Role): Promise<void> {
    const email = (this.config.get<string>('SUPER_ADMIN_EMAIL') ?? '').toLowerCase().trim();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? '';
    const firstName = this.config.get<string>('SUPER_ADMIN_FIRST_NAME') ?? 'Super';
    const lastName = this.config.get<string>('SUPER_ADMIN_LAST_NAME') ?? 'Admin';
    const phoneNumber = this.config.get<string>('SUPER_ADMIN_PHONE') ?? null;

    if (!email || !password) {
      this.logger.warn(
        'SUPER_ADMIN_EMAIL o SUPER_ADMIN_PASSWORD no definidos; se omite la creación del Super Admin',
      );
      return;
    }

    let user = await this.usersRepo.findOne({
      where: { email },
      relations: { roles: true },
      withDeleted: true,
    });

    if (!user) {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      user = this.usersRepo.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password: hash,
        isActive: true,
        isSuperAdmin: true,
        roles: [role],
      });
      await this.usersRepo.save(user);
      this.logger.log(`Super Admin creado: ${email}`);
      return;
    }

    if (user.deletedAt) {
      await this.usersRepo.restore(user.id);
      user.deletedAt = null;
    }
    user.firstName = firstName;
    user.lastName = lastName;
    user.phoneNumber = phoneNumber;
    user.isActive = true;
    user.isSuperAdmin = true;
    user.roles = [role];
    await this.usersRepo.save(user);
    this.logger.log(`Super Admin asegurado: ${email}`);
  }
}
