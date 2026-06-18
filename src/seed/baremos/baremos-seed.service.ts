import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { InsuranceServicePrice } from '../../insurances/entities/insurance-service-price.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { DoctorServicePrice } from '../../doctors/entities/doctor-service-price.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { BAREMO_INSURANCES } from './baremos.data';
import { BAREMO_DOCTORS } from './baremos-doctors.data';

const CHUNK = 200;

/** Quita diacríticos (NFD + remueve combinantes). */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Clave de agrupación: sin acentos, MAYÚSCULAS, sin espacios extremos. */
function normKey(s: string): string {
  return stripAccents(s).toUpperCase().trim();
}

/** True si el nombre tiene algún acento/diacrítico. */
function isAccented(s: string): boolean {
  return s !== stripAccents(s);
}

/** Prefiere el nombre acentuado; ante empate conserva el primero (`a`). */
function preferName(a: string, b: string): string {
  return isAccented(b) && !isAccented(a) ? b : a;
}

/** Tablas con FK a service_types y su columna "dueño" (para el índice único/PK). */
const ST_REFERENCES: Array<{ table: string; owner: string; extra?: string }> = [
  { table: 'insurance_service_prices', owner: 'insuranceId' },
  { table: 'doctor_service_prices', owner: 'doctorId' },
  { table: 'care_center_service_prices', owner: 'careCenterId' },
  { table: 'order_service_types', owner: 'orderId' },
  { table: 'order_service_pricing', owner: 'orderId', extra: 'kind' },
];

/**
 * Seeder de baremos (independiente del SeedService principal). A partir de
 * `baremos.data.ts` (horneado desde /baremos/*.xlsx):
 *
 *  1. Fusión de duplicados por acento: el catálogo trae nombres equivalentes que
 *     sólo difieren en acentos/mayúsculas (ej. "HEMATOLOGIA COMPLETA" vs
 *     "HEMATOLOGÍA COMPLETA"). Se conserva la variante ACENTUADA y se repuntan
 *     sus asociaciones (precios de seguro/doctor/centro, órdenes) al sobreviviente.
 *  2. Tipos de servicio: unión de todos los baremos agrupada por clave sin
 *     acentos. `particularPriceUsd` por defecto = MÁXIMO precio de seguro hallado
 *     (sólo se setea si está vacío, no pisa ediciones manuales).
 *  3. Seguros: crea/reactiva los seguros por nombre.
 *  4. `insurance_service_prices`: precio USD por (seguro, tipo de servicio).
 *  5. Doctores + `doctor_service_prices` (baremo Particular).
 *
 * Idempotente: re-ejecutable. Match de tipos de servicio por clave normalizada
 * (sin acentos). Ejecutar con `npm run seed:baremos`.
 */
@Injectable()
export class BaremosSeedService {
  private readonly logger = new Logger(BaremosSeedService.name);

  constructor(
    @InjectRepository(ServiceType)
    private readonly stRepo: Repository<ServiceType>,
    @InjectRepository(Insurance)
    private readonly insRepo: Repository<Insurance>,
    @InjectRepository(InsuranceServicePrice)
    private readonly ispRepo: Repository<InsuranceServicePrice>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorServicePrice)
    private readonly dspRepo: Repository<DoctorServicePrice>,
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
  ) {}

  async run(): Promise<void> {
    const stIdByKey = await this.seedServiceTypes();
    const insIdByKey = await this.seedInsurances();
    await this.seedInsurancePrices(stIdByKey, insIdByKey);
    await this.seedDoctors(stIdByKey);
    this.logger.log('Seed de baremos completado');
  }

  /**
   * Fusiona tipos de servicio que sólo difieren por acentos/mayúsculas. El
   * sobreviviente es la variante acentuada (restaurada si estaba en papelera);
   * los demás ceden sus referencias y se eliminan.
   */
  private async consolidateAccentDuplicates(): Promise<void> {
    const all = await this.stRepo.find({ withDeleted: true });
    const groups = new Map<string, ServiceType[]>();
    for (const st of all) {
      const k = normKey(st.name);
      const g = groups.get(k);
      if (g) g.push(st);
      else groups.set(k, [st]);
    }

    let merged = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const survivor = this.pickSurvivor(group);
      if (survivor.deletedAt) {
        await this.stRepo.restore(survivor.id);
        survivor.deletedAt = null;
      }
      for (const loser of group) {
        if (loser.id === survivor.id) continue;
        await this.repointReferences(loser.id, survivor.id);
        await this.stRepo.manager.query(
          'DELETE FROM "service_types" WHERE id = $1',
          [loser.id],
        );
        merged++;
      }
    }
    if (merged > 0)
      this.logger.log(
        `Tipos de servicio duplicados (acento) fusionados: ${merged}`,
      );
  }

  /** Elige sobreviviente: acentuado primero, luego no borrado, luego id (estable). */
  private pickSurvivor(group: ServiceType[]): ServiceType {
    return [...group].sort((a, b) => {
      const aAcc = isAccented(a.name) ? 0 : 1;
      const bAcc = isAccented(b.name) ? 0 : 1;
      if (aAcc !== bAcc) return aAcc - bAcc;
      const aDel = a.deletedAt ? 1 : 0;
      const bDel = b.deletedAt ? 1 : 0;
      if (aDel !== bDel) return aDel - bDel;
      return a.id < b.id ? -1 : 1;
    })[0];
  }

  /**
   * Mueve las referencias de `loserId` a `survivorId` en todas las tablas con FK
   * a service_types, saltando las filas que chocarían con el índice único/PK del
   * sobreviviente (esas se descartan).
   */
  private async repointReferences(
    loserId: string,
    survivorId: string,
  ): Promise<void> {
    const m = this.stRepo.manager;
    for (const r of ST_REFERENCES) {
      const conflict = [
        `x."${r.owner}" = t."${r.owner}"`,
        `x."serviceTypeId" = $2`,
      ]
        .concat(r.extra ? [`x."${r.extra}" = t."${r.extra}"`] : [])
        .join(' AND ');
      await m.query(
        `UPDATE "${r.table}" t SET "serviceTypeId" = $2
         WHERE t."serviceTypeId" = $1
           AND NOT EXISTS (SELECT 1 FROM "${r.table}" x WHERE ${conflict})`,
        [loserId, survivorId],
      );
      await m.query(`DELETE FROM "${r.table}" WHERE "serviceTypeId" = $1`, [
        loserId,
      ]);
    }
  }

  /**
   * Unión de tipos de servicio con particular = máximo precio de seguro. Agrupa
   * por clave sin acentos y conserva el nombre acentuado como canónico.
   */
  private async seedServiceTypes(): Promise<Map<string, string>> {
    await this.consolidateAccentDuplicates();

    const union = new Map<string, { name: string; max: number }>();
    for (const ins of BAREMO_INSURANCES) {
      for (const s of ins.services) {
        const key = normKey(s.name);
        const cur = union.get(key);
        if (!cur) union.set(key, { name: s.name, max: s.priceUsd });
        else {
          if (s.priceUsd > cur.max) cur.max = s.priceUsd;
          cur.name = preferName(cur.name, s.name);
        }
      }
    }

    const existing = await this.stRepo.find({ withDeleted: true });
    const byKey = new Map(
      existing.map((st) => [normKey(st.name), st] as const),
    );

    const toInsert: ServiceType[] = [];
    const toUpdate: ServiceType[] = [];
    for (const { name, max } of union.values()) {
      const key = normKey(name);
      const ex = byKey.get(key);
      const price = max.toFixed(2);
      if (!ex) {
        const e = this.stRepo.create({
          name,
          particularPriceUsd: price,
          isActive: true,
        });
        toInsert.push(e);
        byKey.set(key, e);
      } else {
        let touched = false;
        // impone la variante acentuada como nombre del catálogo
        if (ex.name !== name) {
          ex.name = name;
          touched = true;
        }
        // sólo rellena si está vacío; no pisa precios particulares editados
        if (ex.particularPriceUsd == null) {
          ex.particularPriceUsd = price;
          touched = true;
        }
        if (touched) toUpdate.push(ex);
      }
    }

    await this.chunkedSave(this.stRepo, toInsert);
    await this.chunkedSave(this.stRepo, toUpdate);
    this.logger.log(
      `Tipos de servicio: insertados=${toInsert.length} actualizados=${toUpdate.length} total catálogo=${union.size}`,
    );

    // byKey ahora tiene ids (save muta las entidades insertadas)
    return new Map([...byKey].map(([k, st]) => [k, st.id] as const));
  }

  /** Crea/reactiva los seguros por nombre. */
  private async seedInsurances(): Promise<Map<string, string>> {
    const existing = await this.insRepo.find({ withDeleted: true });
    const byName = new Map(
      existing.map((i) => [i.name.toUpperCase(), i] as const),
    );

    const result = new Map<string, string>();
    let created = 0;
    let reactivated = 0;
    for (const ins of BAREMO_INSURANCES) {
      const key = ins.name.toUpperCase();
      let entity = byName.get(key);
      if (!entity) {
        entity = await this.insRepo.save(
          this.insRepo.create({
            name: ins.name,
            rif: ins.rif ?? null,
            description: 'Importado de baremo',
            isActive: true,
          }),
        );
        created++;
      } else {
        let touched = false;
        if (entity.deletedAt) {
          await this.insRepo.restore(entity.id);
          entity.deletedAt = null;
          touched = true;
        }
        if (!entity.isActive) {
          entity.isActive = true;
          touched = true;
        }
        if (touched) {
          await this.insRepo.save(entity);
          reactivated++;
        }
      }
      result.set(key, entity.id);
    }
    this.logger.log(
      `Seguros: creados=${created} reactivados=${reactivated} total=${BAREMO_INSURANCES.length}`,
    );
    return result;
  }

  /** Upsert de precios USD por (seguro, tipo de servicio). */
  private async seedInsurancePrices(
    stIdByKey: Map<string, string>,
    insIdByKey: Map<string, string>,
  ): Promise<void> {
    let inserted = 0;
    let updated = 0;
    for (const ins of BAREMO_INSURANCES) {
      const insuranceId = insIdByKey.get(ins.name.toUpperCase());
      if (!insuranceId) continue;

      const existing = await this.ispRepo.find({ where: { insuranceId } });
      const byST = new Map(existing.map((p) => [p.serviceTypeId, p] as const));

      const toInsert: InsuranceServicePrice[] = [];
      const toUpdate: InsuranceServicePrice[] = [];
      const seen = new Set<string>();
      for (const s of ins.services) {
        const serviceTypeId = stIdByKey.get(normKey(s.name));
        if (!serviceTypeId) continue;
        // dos variantes (acento/no) del mismo baremo colapsan al mismo ST: el
        // primero gana, evita doble insert del par (insuranceId, serviceTypeId).
        if (seen.has(serviceTypeId)) continue;
        seen.add(serviceTypeId);
        const price = s.priceUsd.toFixed(2);
        const ex = byST.get(serviceTypeId);
        if (!ex) {
          toInsert.push(
            this.ispRepo.create({
              insuranceId,
              serviceTypeId,
              priceUsd: price,
            }),
          );
        } else if (ex.priceUsd !== price) {
          ex.priceUsd = price;
          toUpdate.push(ex);
        }
      }
      await this.chunkedSave(this.ispRepo, toInsert);
      await this.chunkedSave(this.ispRepo, toUpdate);
      inserted += toInsert.length;
      updated += toUpdate.length;
    }
    this.logger.log(
      `Precios de seguro: insertados=${inserted} actualizados=${updated}`,
    );
  }

  /**
   * Baremo Particular: precios a pagar a doctores. Crea doctor (cédula
   * placeholder), especialidad si falta, los vincula, y registra el precio en
   * doctor_service_prices. Los tipos de servicio se resuelven contra el catálogo
   * ya consolidado (clave sin acentos); si falta uno, se crea con su nombre tal cual.
   */
  private async seedDoctors(stIdByKey: Map<string, string>): Promise<void> {
    const specByKey = await this.ensureCatalog(
      this.specialtyRepo,
      [...new Set(BAREMO_DOCTORS.map((d) => d.specialtyName))],
      (name) => this.specialtyRepo.create({ name, isActive: true }),
    );

    const existingDoctors = await this.doctorRepo.find({ withDeleted: true });
    const docByName = new Map(
      existingDoctors.map(
        (d) => [`${d.firstName}|${d.lastName}`.toUpperCase(), d] as const,
      ),
    );

    let createdDoctors = 0;
    let createdServiceTypes = 0;
    let pricesInserted = 0;
    let pricesUpdated = 0;
    for (const d of BAREMO_DOCTORS) {
      const nameKey = `${d.firstName}|${d.lastName}`.toUpperCase();
      const specialty = specByKey.get(d.specialtyName.toUpperCase());
      let doctor = docByName.get(nameKey);
      if (!doctor) {
        doctor = await this.doctorRepo.save(
          this.doctorRepo.create({
            cedula: d.cedula,
            firstName: d.firstName,
            lastName: d.lastName,
            isLegalEntity: false,
            isActive: true,
            specialties: specialty ? [specialty] : [],
          }),
        );
        docByName.set(nameKey, doctor);
        createdDoctors++;
      } else {
        let touched = false;
        if (doctor.deletedAt) {
          await this.doctorRepo.restore(doctor.id);
          doctor.deletedAt = null;
          touched = true;
        }
        // vincula la especialidad si aún no la tiene
        if (
          specialty &&
          !(doctor.specialties ?? []).some((s) => s.id === specialty.id)
        ) {
          doctor.specialties = [...(doctor.specialties ?? []), specialty];
          touched = true;
        }
        if (touched) await this.doctorRepo.save(doctor);
      }

      // resuelve el ST por clave normalizada; lo crea si es exclusivo del baremo particular
      const stKey = normKey(d.serviceTypeName);
      let serviceTypeId = stIdByKey.get(stKey);
      if (!serviceTypeId) {
        const createdSt = await this.stRepo.save(
          this.stRepo.create({ name: d.serviceTypeName, isActive: true }),
        );
        serviceTypeId = createdSt.id;
        stIdByKey.set(stKey, serviceTypeId);
        createdServiceTypes++;
      }

      const price = d.priceUsd.toFixed(2);
      const existing = await this.dspRepo.findOne({
        where: { doctorId: doctor.id, serviceTypeId },
      });
      if (!existing) {
        await this.dspRepo.save(
          this.dspRepo.create({
            doctorId: doctor.id,
            serviceTypeId,
            priceUsd: price,
          }),
        );
        pricesInserted++;
      } else if (existing.priceUsd !== price) {
        existing.priceUsd = price;
        await this.dspRepo.save(existing);
        pricesUpdated++;
      }
    }
    this.logger.log(
      `Doctores: creados=${createdDoctors}/${BAREMO_DOCTORS.length} especialidades=${specByKey.size} STs nuevos=${createdServiceTypes} | precios insertados=${pricesInserted} actualizados=${pricesUpdated}`,
    );
  }

  /**
   * Asegura que existan filas (por nombre, case-insensitive) en un catálogo con
   * columna `name` única. Reactiva soft-deleted. Devuelve Map(UPPER name -> entidad).
   */
  private async ensureCatalog<
    T extends { id: string; name: string; deletedAt?: Date | null },
  >(
    repo: Repository<T>,
    names: string[],
    make: (name: string) => T,
  ): Promise<Map<string, T>> {
    const existing = await repo.find({
      where: { name: In(names) } as never,
      withDeleted: true,
    });
    const byKey = new Map(
      existing.map((e) => [e.name.toUpperCase(), e] as const),
    );
    for (const name of names) {
      const ex = byKey.get(name.toUpperCase());
      if (!ex) {
        const created = await repo.save(make(name));
        byKey.set(name.toUpperCase(), created);
      } else if (ex.deletedAt) {
        await repo.restore(ex.id as never);
        ex.deletedAt = null;
      }
    }
    return byKey;
  }

  private async chunkedSave<T>(repo: Repository<T>, rows: T[]): Promise<void> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await repo.save(rows.slice(i, i + CHUNK));
    }
  }
}
