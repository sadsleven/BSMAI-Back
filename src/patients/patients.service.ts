import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { PatientPhone } from './entities/patient-phone.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { PhoneDto } from './dto/phone.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { normalizeCedula } from '../shared/validators/ve-formats';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private readonly repo: Repository<Patient>,
    @InjectRepository(PatientPhone)
    private readonly phonesRepo: Repository<PatientPhone>,
    @InjectRepository(Insurance)
    private readonly insurancesRepo: Repository<Insurance>,
  ) {}

  async findAll(query: QueryPatientsDto): Promise<PaginatedResponse<Patient>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      birthDateFrom,
      birthDateTo,
      insuranceId,
    } = query;

    const qb = this.repo
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.phones', 'phone')
      .leftJoinAndSelect('patient.insurances', 'insurance')
      .orderBy(`patient.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('patient.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(patient.firstName) LIKE :s OR LOWER(patient.lastName) LIKE :s OR LOWER(patient.email) LIKE :s OR LOWER(patient.cedula) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('patient.isActive = :a', { a: isActive === 'true' });
    }

    if (birthDateFrom) {
      qb.andWhere('patient.birthDate >= :bdf', { bdf: birthDateFrom });
    }
    if (birthDateTo) {
      qb.andWhere('patient.birthDate <= :bdt', { bdt: birthDateTo });
    }

    if (insuranceId) {
      // Filter via subquery so the JOIN doesn't lose other insurances of the patient
      qb.andWhere(
        `patient.id IN (
          SELECT pi."patientId" FROM patient_insurances pi WHERE pi."insuranceId" = :insId
        )`,
        { insId: insuranceId },
      );
    }

    return paginateBuilder<Patient>(qb, page, limit);
  }

  async findOne(id: string, withDeleted = false): Promise<Patient> {
    const patient = await this.repo.findOne({
      where: { id },
      relations: { phones: true, insurances: true },
      withDeleted,
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    return patient;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const cedula = normalizeCedula(dto.cedula);
    const email = dto.email.toLowerCase().trim();

    await this.assertUniqueCedula(cedula);
    await this.assertUniqueEmail(email);

    const insurances = await this.resolveInsurances(dto.insuranceIds ?? []);

    const patient = this.repo.create({
      cedula,
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      birthDate: dto.birthDate,
      address: dto.address.trim(),
      isActive: dto.isActive ?? true,
      phones: dto.phones.map((p) => this.phonesRepo.create(this.phonePayload(p))),
      insurances,
    });
    return this.repo.save(patient);
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOne(id);

    if (dto.cedula) {
      const cedula = normalizeCedula(dto.cedula);
      if (cedula !== patient.cedula) {
        await this.assertUniqueCedula(cedula);
        patient.cedula = cedula;
      }
    }
    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      if (email !== patient.email) {
        await this.assertUniqueEmail(email);
        patient.email = email;
      }
    }
    if (dto.firstName !== undefined) patient.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) patient.lastName = dto.lastName.trim();
    if (dto.birthDate !== undefined) patient.birthDate = dto.birthDate;
    if (dto.address !== undefined) patient.address = dto.address.trim();
    if (dto.isActive !== undefined) patient.isActive = dto.isActive;

    if (dto.phones) {
      await this.phonesRepo.delete({ patientId: patient.id });
      patient.phones = dto.phones.map((p) =>
        this.phonesRepo.create({ ...this.phonePayload(p), patientId: patient.id }),
      );
    }

    if (dto.insuranceIds !== undefined) {
      patient.insurances = await this.resolveInsurances(
        dto.insuranceIds,
        patient.insurances ?? [],
      );
    }

    return this.repo.save(patient);
  }

  async toggleActive(id: string): Promise<Patient> {
    const patient = await this.findOne(id);
    patient.isActive = !patient.isActive;
    return this.repo.save(patient);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Patient> {
    const patient = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!patient.deletedAt) return patient;
    await this.repo.restore(id);
    return this.findOne(id);
  }

  private phonePayload(p: PhoneDto) {
    return { number: p.number, label: p.label ?? null };
  }

  private async assertUniqueCedula(cedula: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { cedula }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un paciente con esa cédula');
  }

  private async assertUniqueEmail(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un paciente con ese email');
  }

  /**
   * Resolve insurance IDs into entities. New IDs (not already in `current`) must be
   * active and non-deleted. Stale IDs already attached to the patient are kept silently
   * so the caller can keep them as removable chips in the UI.
   */
  private async resolveInsurances(
    ids: string[],
    current: Insurance[] = [],
  ): Promise<Insurance[]> {
    if (!ids.length) return [];
    const unique = Array.from(new Set(ids));
    const currentIds = new Set(current.map((i) => i.id));
    const newIds = unique.filter((id) => !currentIds.has(id));

    // For new IDs (additions), require active + non-deleted
    if (newIds.length) {
      const valid = await this.insurancesRepo.find({
        where: { id: In(newIds), isActive: true, deletedAt: IsNull() },
      });
      if (valid.length !== newIds.length) {
        const validIds = new Set(valid.map((v) => v.id));
        const missing = newIds.filter((id) => !validIds.has(id));
        throw new BadRequestException(
          `Algunos seguros no existen, están deshabilitados o en papelera: ${missing.join(', ')}`,
        );
      }
    }

    // Hydrate full set (including stale already-attached ones) using withDeleted to keep them
    const entities = await this.insurancesRepo.find({
      where: { id: In(unique) },
      withDeleted: true,
    });
    return entities;
  }
}
