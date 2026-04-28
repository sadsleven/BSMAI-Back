import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Patient, PersonType } from './entities/patient.entity';
import { PatientPhone } from './entities/patient-phone.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { Contractor } from '../contractors/entities/contractor.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { PhoneDto } from './dto/phone.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { normalizeCedula, normalizeRif } from '../shared/validators/ve-formats';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private readonly repo: Repository<Patient>,
    @InjectRepository(PatientPhone)
    private readonly phonesRepo: Repository<PatientPhone>,
    @InjectRepository(Insurance)
    private readonly insurancesRepo: Repository<Insurance>,
    @InjectRepository(Contractor)
    private readonly contractorsRepo: Repository<Contractor>,
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
      contractorId,
      personType,
    } = query;

    const qb = this.repo
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.phones', 'phone')
      .leftJoinAndSelect('patient.insurances', 'insurance')
      .leftJoinAndSelect('patient.contractors', 'contractor')
      .orderBy(`patient.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('patient.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        `(LOWER(patient.firstName) LIKE :s
          OR LOWER(patient.lastName) LIKE :s
          OR LOWER(patient.businessName) LIKE :s
          OR LOWER(patient.email) LIKE :s
          OR LOWER(patient.cedula) LIKE :s
          OR LOWER(patient.rif) LIKE :s)`,
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('patient.isActive = :a', { a: isActive === 'true' });
    }

    if (personType) {
      qb.andWhere('patient.personType = :pt', { pt: personType });
    }

    if (birthDateFrom) {
      qb.andWhere('patient.birthDate >= :bdf', { bdf: birthDateFrom });
    }
    if (birthDateTo) {
      qb.andWhere('patient.birthDate <= :bdt', { bdt: birthDateTo });
    }

    if (insuranceId) {
      qb.andWhere(
        `patient.id IN (
          SELECT pi."patientId" FROM patient_insurances pi WHERE pi."insuranceId" = :insId
        )`,
        { insId: insuranceId },
      );
    }

    if (contractorId) {
      qb.andWhere(
        `patient.id IN (
          SELECT pc."patientId" FROM patient_contractors pc WHERE pc."contractorId" = :ctrId
        )`,
        { ctrId: contractorId },
      );
    }

    return paginateBuilder<Patient>(qb, page, limit);
  }

  async findOne(id: string, withDeleted = false): Promise<Patient> {
    const patient = await this.repo.findOne({
      where: { id },
      relations: { phones: true, insurances: true, contractors: true },
      withDeleted,
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    return patient;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    this.assertPersonTypeFields(dto.personType, dto);

    const email = dto.email.toLowerCase().trim();
    await this.assertUniqueEmail(email);

    const base: Partial<Patient> = {
      personType: dto.personType,
      email,
      birthDate: dto.birthDate,
      address: dto.address.trim(),
      isActive: dto.isActive ?? true,
    };

    if (dto.personType === 'natural') {
      const cedula = normalizeCedula(dto.cedula!);
      await this.assertUniqueCedula(cedula);
      Object.assign(base, {
        cedula,
        firstName: dto.firstName!.trim(),
        lastName: dto.lastName!.trim(),
        businessName: null,
        rif: null,
      });
    } else {
      const rif = normalizeRif(dto.rif!);
      await this.assertUniqueRif(rif);
      Object.assign(base, {
        rif,
        businessName: dto.businessName!.trim(),
        firstName: null,
        lastName: null,
        cedula: null,
      });
    }

    const insurances = await this.resolveInsurances(dto.insuranceIds ?? []);
    const contractors = await this.resolveContractors(dto.contractorIds ?? []);

    const patient = this.repo.create({
      ...base,
      phones: dto.phones.map((p) => this.phonesRepo.create(this.phonePayload(p))),
      insurances,
      contractors,
    });
    return this.repo.save(patient);
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOne(id);

    // Effective personType: from DTO if present, else current.
    const effectiveType: PersonType = dto.personType ?? patient.personType;

    // Build a merged view to validate field coherence post-update.
    const merged = {
      personType: effectiveType,
      cedula: dto.cedula !== undefined ? dto.cedula : patient.cedula,
      firstName: dto.firstName !== undefined ? dto.firstName : patient.firstName,
      lastName: dto.lastName !== undefined ? dto.lastName : patient.lastName,
      businessName:
        dto.businessName !== undefined ? dto.businessName : patient.businessName,
      rif: dto.rif !== undefined ? dto.rif : patient.rif,
    };
    this.assertPersonTypeFields(effectiveType, merged);

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      if (email !== patient.email) {
        await this.assertUniqueEmail(email);
        patient.email = email;
      }
    }

    if (effectiveType === 'natural') {
      const cedula = normalizeCedula(merged.cedula!);
      if (cedula !== patient.cedula) {
        await this.assertUniqueCedula(cedula);
      }
      patient.personType = 'natural';
      patient.cedula = cedula;
      patient.firstName = merged.firstName!.trim();
      patient.lastName = merged.lastName!.trim();
      patient.businessName = null;
      patient.rif = null;
    } else {
      const rif = normalizeRif(merged.rif!);
      if (rif !== patient.rif) {
        await this.assertUniqueRif(rif);
      }
      patient.personType = 'legal_entity';
      patient.rif = rif;
      patient.businessName = merged.businessName!.trim();
      patient.firstName = null;
      patient.lastName = null;
      patient.cedula = null;
    }

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

    if (dto.contractorIds !== undefined) {
      patient.contractors = await this.resolveContractors(
        dto.contractorIds,
        patient.contractors ?? [],
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

  /** Cross-check campo↔personType. Defensa de invariantes contra clientes maliciosos. */
  private assertPersonTypeFields(
    personType: PersonType,
    fields: {
      cedula?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      businessName?: string | null;
      rif?: string | null;
    },
  ) {
    if (personType === 'natural') {
      if (!fields.cedula || !fields.firstName || !fields.lastName) {
        throw new BadRequestException(
          'Persona natural requiere cédula, nombre y apellido',
        );
      }
      if (fields.businessName || fields.rif) {
        throw new BadRequestException(
          'Persona natural no puede tener razón social ni RIF',
        );
      }
    } else {
      if (!fields.businessName || !fields.rif) {
        throw new BadRequestException(
          'Persona jurídica requiere razón social y RIF',
        );
      }
      if (fields.cedula || fields.firstName || fields.lastName) {
        throw new BadRequestException(
          'Persona jurídica no puede tener cédula, nombre ni apellido',
        );
      }
    }
  }

  private async assertUniqueCedula(cedula: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { cedula }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un paciente con esa cédula');
  }

  private async assertUniqueRif(rif: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { rif }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un paciente con ese RIF');
  }

  private async assertUniqueEmail(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un paciente con ese email');
  }

  /**
   * Resolve insurance IDs into entities. New IDs (not already in `current`) must be
   * active and non-deleted. Stale IDs already attached are kept silently.
   */
  private async resolveInsurances(
    ids: string[],
    current: Insurance[] = [],
  ): Promise<Insurance[]> {
    if (!ids.length) return [];
    const unique = Array.from(new Set(ids));
    const currentIds = new Set(current.map((i) => i.id));
    const newIds = unique.filter((id) => !currentIds.has(id));

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

    const entities = await this.insurancesRepo.find({
      where: { id: In(unique) },
      withDeleted: true,
    });
    return entities;
  }

  /** Mismo patrón que resolveInsurances pero para contratistas. */
  private async resolveContractors(
    ids: string[],
    current: Contractor[] = [],
  ): Promise<Contractor[]> {
    if (!ids.length) return [];
    const unique = Array.from(new Set(ids));
    const currentIds = new Set(current.map((c) => c.id));
    const newIds = unique.filter((id) => !currentIds.has(id));

    if (newIds.length) {
      const valid = await this.contractorsRepo.find({
        where: { id: In(newIds), isActive: true, deletedAt: IsNull() },
      });
      if (valid.length !== newIds.length) {
        const validIds = new Set(valid.map((v) => v.id));
        const missing = newIds.filter((id) => !validIds.has(id));
        throw new BadRequestException(
          `Algunos contratistas no existen, están deshabilitados o en papelera: ${missing.join(', ')}`,
        );
      }
    }

    const entities = await this.contractorsRepo.find({
      where: { id: In(unique) },
      withDeleted: true,
    });
    return entities;
  }
}
