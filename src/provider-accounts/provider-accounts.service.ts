import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';

const BCRYPT_ROUNDS = 10;

/** Nombre del rol sembrado para usuarios proveedores (doctores / centros). */
export const PROVIDER_ROLE_NAME = 'Proveedor';

export type ProviderOwnerType = 'doctor' | 'care_center';

/** Vínculo de un User con su proveedor (doctor o centro). */
export interface ProviderLink {
  type: ProviderOwnerType;
  id: string;
  name: string;
}

/**
 * Servicio compartido para gestionar las cuentas de usuario vinculadas a
 * proveedores (doctores / centros de atención). Centraliza el alta/cambio de
 * password y la resolución `user → proveedor`, evitando duplicar la lógica en
 * Doctors/CareCenters/Orders/Files.
 */
@Injectable()
export class ProviderAccountsService {
  private readonly logger = new Logger(ProviderAccountsService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    @InjectRepository(CareCenter)
    private readonly careCentersRepo: Repository<CareCenter>,
  ) {}

  /**
   * Crea o actualiza la cuenta de usuario vinculada a un proveedor.
   * - Sin `existingUserId`: requiere `password` → crea User con rol Proveedor.
   * - Con `existingUserId`: sincroniza email/nombre y, si vino `password`, la cambia.
   * Devuelve el userId vinculado.
   */
  async provisionOrUpdateAccount(opts: {
    existingUserId?: string | null;
    email: string;
    firstName: string;
    lastName: string;
    password?: string | null;
  }): Promise<string> {
    const email = opts.email.toLowerCase().trim();
    if (!email) {
      throw new BadRequestException(
        'El email es requerido para habilitar el acceso del proveedor',
      );
    }
    const firstName = opts.firstName.trim().slice(0, 120) || email;
    const lastName = opts.lastName.trim().slice(0, 120) || '—';

    if (opts.existingUserId) {
      const user = await this.usersRepo.findOne({
        where: { id: opts.existingUserId },
        withDeleted: true,
      });
      if (!user) {
        // Vínculo colgante (el usuario fue borrado por fuera): recrear.
        return this.createAccount({ email, firstName, lastName, password: opts.password });
      }
      if (user.deletedAt) {
        await this.usersRepo.restore(user.id);
        user.deletedAt = null;
      }
      if (email !== user.email) {
        await this.assertEmailFree(email, user.id);
        user.email = email;
      }
      user.firstName = firstName;
      user.lastName = lastName;
      user.isActive = true;
      if (opts.password) {
        user.password = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
      }
      await this.usersRepo.save(user);
      return user.id;
    }

    if (!opts.password) {
      throw new BadRequestException(
        'Definí una contraseña para habilitar el acceso del proveedor',
      );
    }
    return this.createAccount({ email, firstName, lastName, password: opts.password });
  }

  private async createAccount(opts: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string | null;
  }): Promise<string> {
    if (!opts.password) throw new BadRequestException('Contraseña requerida');
    await this.assertEmailFree(opts.email, null);
    const role = await this.getProviderRole();
    if (!role) {
      throw new BadRequestException(
        `No existe el rol "${PROVIDER_ROLE_NAME}". Corré el seed antes de habilitar accesos.`,
      );
    }
    const hash = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      firstName: opts.firstName,
      lastName: opts.lastName,
      email: opts.email,
      password: hash,
      isActive: true,
      isSuperAdmin: false,
      roles: [role],
      branches: [],
    });
    const saved = await this.usersRepo.save(user);
    return saved.id;
  }

  /** Cambio de password administrativo (sin verificar la actual). */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Cuenta de usuario no encontrada');
    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersRepo.save(user);
  }

  /** Propaga habilitar/deshabilitar (y papelera) al usuario vinculado. */
  async setAccountActive(
    userId: string | null | undefined,
    isActive: boolean,
  ): Promise<void> {
    if (!userId) return;
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) return;
    if (user.deletedAt) {
      if (!isActive) return; // ya inaccesible
      await this.usersRepo.restore(user.id);
      user.deletedAt = null;
    }
    user.isActive = isActive;
    await this.usersRepo.save(user);
  }

  /** Resuelve el proveedor (doctor/centro) vinculado a un usuario, o null. */
  async findProviderByUserId(userId: string): Promise<ProviderLink | null> {
    const doctor = await this.doctorsRepo.findOne({ where: { userId } });
    if (doctor) {
      return {
        type: 'doctor',
        id: doctor.id,
        name: `${doctor.firstName} ${doctor.lastName}`.trim(),
      };
    }
    const center = await this.careCentersRepo.findOne({ where: { userId } });
    if (center) {
      return { type: 'care_center', id: center.id, name: center.businessName };
    }
    return null;
  }

  private async getProviderRole(): Promise<Role | null> {
    return this.rolesRepo.findOne({ where: { name: PROVIDER_ROLE_NAME } });
  }

  private async assertEmailFree(
    email: string,
    exceptUserId: string | null,
  ): Promise<void> {
    const existing = await this.usersRepo.findOne({
      where: { email },
      withDeleted: true,
    });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }
  }
}
