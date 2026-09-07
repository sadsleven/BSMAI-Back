import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BAREMO_TARGETS,
  BaremosSeedService,
  selectBaremos,
  type BaremoTarget,
  type BaremosSeedOptions,
} from './seed/baremos/baremos-seed.service';

/** Sinónimos aceptados en la línea de comandos (ES/EN, singular/plural). */
const ALIASES: Record<string, BaremoTarget> = {
  insurances: 'insurances',
  insurance: 'insurances',
  seguros: 'insurances',
  seguro: 'insurances',
  doctors: 'doctors',
  doctor: 'doctors',
  doctores: 'doctors',
  medicos: 'doctors',
  'care-centers': 'care-centers',
  'care-center': 'care-centers',
  carecenters: 'care-centers',
  centros: 'care-centers',
  centro: 'care-centers',
};

const USAGE = `Seeder de baremos.

  npm run seed:baremos                        # los tres baremos, todos
  npm run seed:baremos:insurances             # sólo seguros
  npm run seed:baremos:doctors                # sólo doctores
  npm run seed:baremos:care-centers           # sólo centros de atención

Un solo seguro/doctor/centro (el nombre va entre comillas):

  npm run seed:baremos:insurances -- "SEGUROS VENEZUELA C.A"
  npm run seed:baremos:insurances -- --name "C.N.A SEGUROS LA PREVISORA"
  npm run seed:baremos:care-centers -- "CIMA"

Pisar los precios que cambiaron (por defecto sólo se insertan los que faltan,
para no revertir ediciones hechas en la UI):

  npm run seed:baremos:insurances -- "SEGUROS VENEZUELA C.A" --update-prices

El nombre se compara sin acentos ni puntuación y por subcadena, así que
"venezuela" alcanza a "SEGUROS VENEZUELA C.A".`;

interface ParsedArgs extends BaremosSeedOptions {
  targets: BaremoTarget[];
  help: boolean;
}

const targetOf = (token: string): BaremoTarget | undefined =>
  ALIASES[token.trim().toLowerCase()];

/**
 * Traduce los argumentos del CLI. Un token que coincide con un baremo
 * (`insurances`/`doctors`/`care-centers` y sus sinónimos) selecciona ese
 * baremo; cualquier otro token suelto se toma como nombre a filtrar. Sin
 * baremos indicados corren los tres.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const targets: BaremoTarget[] = [];
  const names: string[] = [];
  let updatePrices = false;
  let help = false;

  const addTargets = (raw: string) => {
    for (const token of raw.split(',')) {
      if (!token.trim()) continue;
      const target = targetOf(token);
      if (!target) {
        throw new Error(
          `Baremo desconocido: "${token}". Opciones: ${BAREMO_TARGETS.join(', ')}.`,
        );
      }
      if (!targets.includes(target)) targets.push(target);
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.trim()) continue;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--update-prices' || arg === '--actualizar-precios') {
      updatePrices = true;
      continue;
    }
    if (arg === '--name' || arg === '--nombre') {
      const value = argv[++i];
      if (!value) throw new Error(`Falta el nombre después de "${arg}".`);
      names.push(value);
      continue;
    }
    const named = /^--(?:name|nombre)=(.+)$/.exec(arg);
    if (named) {
      names.push(named[1]);
      continue;
    }
    const only = /^--only=(.+)$/.exec(arg);
    if (only) {
      addTargets(only[1]);
      continue;
    }
    if (arg.startsWith('--')) {
      const target = targetOf(arg.slice(2));
      if (!target) throw new Error(`Opción desconocida: "${arg}".`);
      if (!targets.includes(target)) targets.push(target);
      continue;
    }
    // token suelto: baremo si coincide, si no un nombre a filtrar
    if (targetOf(arg)) addTargets(arg);
    else names.push(arg);
  }

  return {
    targets: targets.length ? targets : [...BAREMO_TARGETS],
    names,
    updatePrices,
    help,
  };
}

/**
 * Entrada CLI del seeder de baremos (separado del seed principal).
 * Uso: `npm run seed:baremos` (todos), `npm run seed:baremos:insurances`
 * (o `:doctors` / `:care-centers`), con `-- "<nombre>"` para uno solo y
 * `--update-prices` para pisar los precios que cambiaron. `--help` lo explica.
 */
async function bootstrap() {
  const { targets, names, updatePrices, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }
  // valida el filtro antes de levantar la app: un nombre mal escrito falla acá,
  // sin esperar a que Nest conecte con la base
  const { insurances, doctors, centers } = selectBaremos(targets, names);
  if (names.length) {
    const elegidos = [
      ...(targets.includes('insurances') ? insurances.map((i) => i.name) : []),
      ...(targets.includes('doctors')
        ? doctors.map((d) => `${d.firstName} ${d.lastName}`)
        : []),
      ...(targets.includes('care-centers')
        ? centers.map((c) => c.businessName)
        : []),
    ];
    console.log(`Baremos seleccionados: ${[...new Set(elegidos)].join(' | ')}`);
  }
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    await app.get(BaremosSeedService).run(targets, { names, updatePrices });
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
