import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { InsuranceServicePrice } from '../../insurances/entities/insurance-service-price.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { DoctorServicePrice } from '../../doctors/entities/doctor-service-price.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { CareCenterServicePrice } from '../../care-centers/entities/care-center-service-price.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { BAREMO_INSURANCES } from './baremos.data';
import { BAREMO_DOCTORS } from './baremos-doctors.data';
import { BAREMO_CARE_CENTERS } from './baremos-care-centers.data';
import {
  STD_CANONICAL_BY_NORMKEY,
  STD_DELETE_NORMKEYS,
} from './standardization-map';
import { BAREMO_NAME_ALIASES } from './baremos-name-aliases';

const CHUNK = 200;

/** Quita caracteres de control (0x00-0x1f y 0x7f). */
function stripControl(s: string): string {
  return Array.from(s)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c > 31 && c !== 127;
    })
    .join('');
}

/** Quita diacríticos (NFD + remueve combinantes). */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Clave de agrupación: sin acentos, MAYÚSCULAS, sin espacios extremos. */
function normKey(s: string): string {
  return stripAccents(s).toUpperCase().trim();
}

const STD_DELETES = new Set(STD_DELETE_NORMKEYS);

/** Alias manuales (baremos-name-aliases.ts) indexados por normKey. */
const MANUAL_ALIASES = new Map(
  Object.entries(BAREMO_NAME_ALIASES).map(
    ([raw, canonical]) => [normKey(stripControl(raw)), canonical] as const,
  ),
);

/**
 * Nombre canónico aprobado (ESTANDARIZACION-BAREMOS.md) para un nombre de baremo.
 * Devuelve `null` si el nombre es basura aprobada para eliminar (se omite del seed).
 * Mantiene en sincronía el seeder con la migración StandardizeServiceTypeNames:
 * ambos salen de `standardization-map.ts` / `*.data.json` (regenerar con
 * `node scripts/gen-baremos-standardization.cjs` si cambia el reporte).
 *
 * Primero se consultan los alias manuales de `baremos-name-aliases.ts` (mapeo
 * a mano de nombres crudos de un Excel al tipo de servicio ya existente); el
 * resultado vuelve a pasar por el mapa de estandarización.
 */
function canonicalName(raw: string): string | null {
  const cleaned = stripControl(raw).trim();
  if (STD_DELETES.has(normKey(cleaned))) return null;
  const aliased = MANUAL_ALIASES.get(normKey(cleaned)) ?? cleaned;
  const k = normKey(aliased);
  if (STD_DELETES.has(k)) return null;
  const mapped = STD_CANONICAL_BY_NORMKEY[k];
  if (mapped) return mapped;
  // estudios RX sueltos (no fusionados): normaliza el prefijo "RX." -> "RX "
  return aliased.replace(/^RX\.\s*/, 'RX ');
}

/**
 * Clave de identidad de un seguro: sin acentos/puntuación, MAYÚSCULAS y sin
 * sufijos societarios (C.A., S.A., C.N.A., S.R.L.). Con esto "Seguros
 * Pirámide", "SEGUROS PIRAMIDE, C.A" y "Seguros Piramide CA" son el mismo.
 */
function insuranceKey(name: string): string {
  return normKey(stripControl(name))
    .replace(/[^A-Z0-9ÑÜ ]+/g, ' ')
    .replace(/\b(C\s*N\s*A|C\s*A|S\s*A|S\s*R\s*L|R\s*L)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
 *  3. Seguros: crea/reactiva. El match es por identidad normalizada
 *     (`insuranceKey`) + los `aliases` del baremo, así que un seguro ya
 *     registrado con otra escritura ("Seguros Pirámide" vs "SEGUROS PIRAMIDE,
 *     C.A") se reutiliza en vez de duplicarse, y su nombre no se toca.
 *  4. `insurance_service_prices`: precio USD por (seguro, tipo de servicio).
 *  5. Doctores + `doctor_service_prices` (baremo Particular).
 *
 * Idempotente: re-ejecutable. Match de tipos de servicio por clave normalizada
 * (sin acentos). Los precios son **insert-only**: sólo se dan de alta los pares
 * que faltan; los ya registrados se dejan como están (no se pisan ediciones
 * manuales ni se revierte un precio cambiado en la UI). Ejecutar con
 * `npm run seed:baremos`.
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
    @InjectRepository(CareCenter)
    private readonly ccRepo: Repository<CareCenter>,
    @InjectRepository(CareCenterServicePrice)
    private readonly ccspRepo: Repository<CareCenterServicePrice>,
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
  ) {}

  async run(): Promise<void> {
    const stIdByKey = await this.seedServiceTypes();
    const insIdByKey = await this.seedInsurances();
    await this.seedInsurancePrices(stIdByKey, insIdByKey);
    await this.seedDoctors(stIdByKey);
    await this.seedCareCenters(stIdByKey);
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
        const cname = canonicalName(s.name); // mapea sinónimos/typos/puntuación al canónico
        if (cname === null) continue; // basura aprobada para omitir
        const key = normKey(cname);
        const cur = union.get(key);
        if (!cur) union.set(key, { name: cname, max: s.priceUsd });
        else {
          if (s.priceUsd > cur.max) cur.max = s.priceUsd;
          cur.name = preferName(cur.name, cname);
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

  /**
   * Crea/reactiva los seguros. El match con lo ya registrado es por identidad
   * normalizada (`insuranceKey`: sin acentos, puntuación ni sufijos C.A./S.A.)
   * más los `aliases` del baremo, de modo que "SEGUROS PIRAMIDE, C.A" y
   * "Seguros Pirámide" son el mismo seguro y NO se duplica. Nunca renombra un
   * seguro existente: manda el nombre que ya tiene el sistema.
   */
  private async seedInsurances(): Promise<Map<string, string>> {
    const existing = await this.insRepo.find({ withDeleted: true });
    const byKey = new Map<string, Insurance[]>();
    for (const i of existing) {
      const k = insuranceKey(i.name);
      const g = byKey.get(k);
      if (g) g.push(i);
      else byKey.set(k, [i]);
    }
    // precios ya cargados por seguro: desempata cuál sobrevive si hay duplicados
    const priceRows: Array<{ insuranceId: string; c: string }> =
      await this.insRepo.manager.query(
        'SELECT "insuranceId", COUNT(*) AS c FROM "insurance_service_prices" GROUP BY "insuranceId"',
      );
    const pricedCount = new Map(
      priceRows.map((r) => [r.insuranceId, Number(r.c)] as const),
    );

    const result = new Map<string, string>();
    let created = 0;
    let reactivated = 0;
    let matched = 0;
    for (const ins of BAREMO_INSURANCES) {
      const key = ins.name.toUpperCase();
      const candidateKeys = [ins.name, ...(ins.aliases ?? [])].map(insuranceKey);
      const matches = candidateKeys.flatMap((k) => byKey.get(k) ?? []);
      const unique = [...new Map(matches.map((m) => [m.id, m])).values()];
      if (unique.length > 1) {
        this.logger.warn(
          `"${ins.name}" coincide con ${unique.length} seguros ya registrados ` +
            `(${unique.map((u) => u.name).join(' | ')}). Se usa el que tiene ` +
            `precios/es más antiguo; unifica los duplicados a mano.`,
        );
      }
      let entity = this.pickInsurance(unique, pricedCount);
      if (entity) {
        matched++;
        if (entity.name !== ins.name) {
          this.logger.log(
            `Seguro "${ins.name}" ya existe como "${entity.name}": se respeta el nombre registrado.`,
          );
        }
      }
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
        byKey.set(insuranceKey(entity.name), [entity]);
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
      `Seguros: creados=${created} reutilizados=${matched} reactivados=${reactivated} total=${BAREMO_INSURANCES.length}`,
    );
    return result;
  }

  /**
   * Ante varios seguros que colapsan a la misma identidad, gana el que ya tiene
   * precios cargados; si empatan, el no borrado y luego el de id menor (estable).
   */
  private pickInsurance(
    candidates: Insurance[],
    priced: Map<string, number>,
  ): Insurance | undefined {
    if (candidates.length <= 1) return candidates[0];
    return [...candidates].sort((a, b) => {
      const aDel = a.deletedAt ? 1 : 0;
      const bDel = b.deletedAt ? 1 : 0;
      if (aDel !== bDel) return aDel - bDel;
      const diff = (priced.get(b.id) ?? 0) - (priced.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : 1;
    })[0];
  }

  /**
   * Alta de precios USD por (seguro, tipo de servicio). SÓLO inserta los que
   * faltan: si el par ya está registrado se respeta el precio en base (puede
   * venir de una edición manual), nunca se pisa.
   *
   * Varias filas de un mismo baremo pueden colapsar al mismo tipo de servicio
   * (el seguro repite el estudio bajo códigos distintos, ej. Oceánica lista
   * "ECOGRAFIA SUPRARRENAL" $40 y "ECOGRAFIA SUPRARENAL" $30). En ese caso
   * gana el MAYOR: son tarifas aprobadas por el seguro y el precio es lo que
   * AFMI cobra, así que quedarse con la menor sería regalar dinero. Se loguea
   * cuántas filas se colapsaron.
   */
  private async seedInsurancePrices(
    stIdByKey: Map<string, string>,
    insIdByKey: Map<string, string>,
  ): Promise<void> {
    let inserted = 0;
    let skipped = 0;
    let collapsed = 0;
    for (const ins of BAREMO_INSURANCES) {
      const insuranceId = insIdByKey.get(ins.name.toUpperCase());
      if (!insuranceId) continue;

      const existing = await this.ispRepo.find({ where: { insuranceId } });
      const byST = new Map(existing.map((p) => [p.serviceTypeId, p] as const));

      // serviceTypeId -> precio a registrar (máximo de las filas que colapsan)
      const wanted = new Map<string, number>();
      for (const s of ins.services) {
        const cname = canonicalName(s.name);
        if (cname === null) continue;
        const serviceTypeId = stIdByKey.get(normKey(cname));
        if (!serviceTypeId) continue;
        const prev = wanted.get(serviceTypeId);
        if (prev === undefined) {
          wanted.set(serviceTypeId, s.priceUsd);
          continue;
        }
        collapsed++;
        if (s.priceUsd > prev) wanted.set(serviceTypeId, s.priceUsd);
      }

      const toInsert: InsuranceServicePrice[] = [];
      for (const [serviceTypeId, priceUsd] of wanted) {
        if (byST.has(serviceTypeId)) {
          skipped++;
          continue;
        }
        toInsert.push(
          this.ispRepo.create({
            insuranceId,
            serviceTypeId,
            priceUsd: priceUsd.toFixed(2),
          }),
        );
      }
      await this.chunkedSave(this.ispRepo, toInsert);
      inserted += toInsert.length;
    }
    this.logger.log(
      `Precios de seguro: insertados=${inserted} ya registrados (omitidos)=${skipped} filas colapsadas al mismo ST=${collapsed}`,
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
    let pricesSkipped = 0;
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

      // resuelve el ST por canónico; lo crea si es exclusivo del baremo particular
      const stCanon = canonicalName(d.serviceTypeName);
      if (stCanon === null) continue; // basura aprobada para omitir
      const stKey = normKey(stCanon);
      let serviceTypeId = stIdByKey.get(stKey);
      if (!serviceTypeId) {
        const createdSt = await this.stRepo.save(
          this.stRepo.create({ name: stCanon, isActive: true }),
        );
        serviceTypeId = createdSt.id;
        stIdByKey.set(stKey, serviceTypeId);
        createdServiceTypes++;
      }

      // precio ya registrado => se respeta (no se pisa una edición manual)
      const existing = await this.dspRepo.findOne({
        where: { doctorId: doctor.id, serviceTypeId },
      });
      if (!existing) {
        await this.dspRepo.save(
          this.dspRepo.create({
            doctorId: doctor.id,
            serviceTypeId,
            priceUsd: d.priceUsd.toFixed(2),
          }),
        );
        pricesInserted++;
      } else {
        pricesSkipped++;
      }
    }
    this.logger.log(
      `Doctores: creados=${createdDoctors}/${BAREMO_DOCTORS.length} especialidades=${specByKey.size} STs nuevos=${createdServiceTypes} | precios insertados=${pricesInserted} ya registrados (omitidos)=${pricesSkipped}`,
    );
  }

  /**
   * Centros de atención con baremo propio (RISLAB, URIMECA). Crea/reactiva el
   * centro por razón social, su especialidad, teléfonos (sólo si el centro no
   * tiene), y upsertea `care_center_service_prices` (lo que cobra el centro).
   * El `particularPriceUsd` del baremo (lo que cobra AFMI) PISA el particular
   * del catálogo: es fuente explícita de negocio, a diferencia del relleno
   * por-defecto (máximo de seguros) de seedServiceTypes, que sólo aplica si
   * está vacío. Los STs se resuelven por canónico y se crean si faltan.
   */
  private async seedCareCenters(stIdByKey: Map<string, string>): Promise<void> {
    const specByKey = await this.ensureCatalog(
      this.specialtyRepo,
      [...new Set(BAREMO_CARE_CENTERS.map((c) => c.specialtyName))],
      (name) => this.specialtyRepo.create({ name, isActive: true }),
    );

    const existingCenters = await this.ccRepo.find({ withDeleted: true });
    const byName = new Map(
      existingCenters.map((cc) => [cc.businessName.toUpperCase(), cc] as const),
    );

    let createdCenters = 0;
    let createdServiceTypes = 0;
    let pricesInserted = 0;
    let pricesSkipped = 0;
    let particularOverridden = 0;
    for (const c of BAREMO_CARE_CENTERS) {
      const specialty = specByKey.get(c.specialtyName.toUpperCase());
      let center = byName.get(c.businessName.toUpperCase());
      if (!center) {
        center = await this.ccRepo.save(
          this.ccRepo.create({
            businessName: c.businessName,
            rif: c.rif,
            centerAddress: c.centerAddress,
            isActive: true,
            specialties: specialty ? [specialty] : [],
            phones: c.phones.map((p) => ({
              number: p.number,
              label: p.label,
            })),
          }),
        );
        byName.set(c.businessName.toUpperCase(), center);
        createdCenters++;
      } else {
        let touched = false;
        if (center.deletedAt) {
          await this.ccRepo.restore(center.id);
          center.deletedAt = null;
          touched = true;
        }
        if (!center.isActive) {
          center.isActive = true;
          touched = true;
        }
        // completa datos faltantes sin pisar ediciones manuales
        if (!center.rif && c.rif) {
          center.rif = c.rif;
          touched = true;
        }
        if (!center.centerAddress && c.centerAddress) {
          center.centerAddress = c.centerAddress;
          touched = true;
        }
        if (
          specialty &&
          !(center.specialties ?? []).some((s) => s.id === specialty.id)
        ) {
          center.specialties = [...(center.specialties ?? []), specialty];
          touched = true;
        }
        if ((center.phones ?? []).length === 0 && c.phones.length > 0) {
          center.phones = c.phones.map(
            (p) => ({ number: p.number, label: p.label }) as never,
          );
          touched = true;
        }
        if (touched) await this.ccRepo.save(center);
      }

      // precios del centro + override del particular AFMI
      const existingPrices = await this.ccspRepo.find({
        where: { careCenterId: center.id },
      });
      const byST = new Map(
        existingPrices.map((p) => [p.serviceTypeId, p] as const),
      );
      const toInsert: CareCenterServicePrice[] = [];
      const particularByStId = new Map<string, string>();
      const seen = new Set<string>();
      for (const s of c.services) {
        const cname = canonicalName(s.name);
        if (cname === null) continue;
        const key = normKey(cname);
        let serviceTypeId = stIdByKey.get(key);
        if (!serviceTypeId) {
          const createdSt = await this.stRepo.save(
            this.stRepo.create({
              name: cname,
              particularPriceUsd:
                s.particularPriceUsd != null
                  ? s.particularPriceUsd.toFixed(2)
                  : null,
              isActive: true,
            }),
          );
          serviceTypeId = createdSt.id;
          stIdByKey.set(key, serviceTypeId);
          createdServiceTypes++;
        } else if (s.particularPriceUsd != null) {
          particularByStId.set(serviceTypeId, s.particularPriceUsd.toFixed(2));
        }
        // dos variantes del baremo que colapsan al mismo ST: primera gana
        if (seen.has(serviceTypeId)) continue;
        seen.add(serviceTypeId);
        // precio ya registrado => se respeta (no se pisa una edicion manual)
        if (byST.has(serviceTypeId)) {
          pricesSkipped++;
          continue;
        }
        toInsert.push(
          this.ccspRepo.create({
            careCenterId: center.id,
            serviceTypeId,
            priceUsd: s.priceUsd.toFixed(2),
          }),
        );
      }
      await this.chunkedSave(this.ccspRepo, toInsert);
      pricesInserted += toInsert.length;

      if (particularByStId.size > 0) {
        const sts = await this.stRepo.find({
          where: { id: In([...particularByStId.keys()]) },
          withDeleted: true,
        });
        const stToUpdate = sts.filter(
          (st) => st.particularPriceUsd !== particularByStId.get(st.id),
        );
        for (const st of stToUpdate) {
          st.particularPriceUsd = particularByStId.get(st.id)!;
        }
        await this.chunkedSave(this.stRepo, stToUpdate);
        particularOverridden += stToUpdate.length;
      }
    }
    this.logger.log(
      `Centros de atención: creados=${createdCenters}/${BAREMO_CARE_CENTERS.length} STs nuevos=${createdServiceTypes} | precios centro insertados=${pricesInserted} ya registrados (omitidos)=${pricesSkipped} | particulares AFMI pisados=${particularOverridden}`,
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
