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
  npm run seed:baremos:insurances -- nombre="C.N.A SEGUROS LA PREVISORA"
  npm run seed:baremos:care-centers -- "CIMA"

Pisar los precios que cambiaron (por defecto sólo se insertan los que faltan,
para no revertir ediciones hechas en la UI):

  npm run seed:baremos:care-centers -- "CIMA, C.A" actualizar-precios

  npm run seed:baremos:care-centers -- "CIMA, C.A" --update-prices

Nota: npm NO reenvia al script los argumentos que empiezan por "--" (avisa
"Unknown cli config"), pero si los expone como npm_config_*, y el seeder lee
npm_config_update_prices; por eso las dos formas de arriba funcionan. El token
sin guiones es el camino seguro: tambien sirve "nombre=..." y "ayuda".
Tambien vale la variable de entorno BAREMOS_UPDATE_PRICES=1.

El nombre se compara sin acentos ni puntuación y por subcadena, así que
"venezuela" alcanza a "SEGUROS VENEZUELA C.A".`;

interface ParsedArgs extends BaremosSeedOptions {
  targets: BaremoTarget[];
  help: boolean;
}

const targetOf = (token: string): BaremoTarget | undefined =>
  ALIASES[token.trim().toLowerCase()];

/**
 * Quita los guiones iniciales y normaliza: `--update-prices`, `-update-prices`
 * y `update-prices` son el mismo token. Necesario porque **npm se come los
 * argumentos que empiezan por `--`** (los toma como config suya y avisa
 * "Unknown cli config"), así que con `npm run` las opciones hay que escribirlas
 * sin guiones y el parser debe aceptar ambas formas.
 */
const optionKey = (token: string): string =>
  token.trim().replace(/^-+/, '').toLowerCase();

/** Sinónimos de la opción "pisar precios" (con o sin guiones). */
const UPDATE_PRICE_FLAGS = new Set([
  'update-prices',
  'updateprices',
  'actualizar-precios',
  'actualizarprecios',
  'pisar-precios',
  'pisar',
]);

/** Sinónimos de la ayuda (con o sin guiones). */
const HELP_FLAGS = new Set(['help', 'h', 'ayuda', '?']);

/**
 * Traduce los argumentos del CLI. Un token que coincide con un baremo
 * (`insurances`/`doctors`/`care-centers` y sus sinónimos) selecciona ese
 * baremo; cualquier otro token suelto se toma como nombre a filtrar. Sin
 * baremos indicados corren los tres.
 *
 * Las opciones se aceptan **con y sin guiones** (`--update-prices` o
 * `actualizar-precios`, `--name X` o `nombre=X`): npm descarta los argumentos
 * que empiezan por `--` antes de pasárselos al script, así que la forma sin
 * guiones es la única que sobrevive a `npm run seed:baremos:* -- ...`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
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
    const bare = arg.trim().replace(/^-+/, '');
    const key = optionKey(arg);
    if (HELP_FLAGS.has(key)) {
      help = true;
      continue;
    }
    if (UPDATE_PRICE_FLAGS.has(key)) {
      updatePrices = true;
      continue;
    }
    if (key === 'name' || key === 'nombre') {
      const value = argv[++i];
      if (!value) throw new Error(`Falta el nombre después de "${arg}".`);
      names.push(value);
      continue;
    }
    // `bare` conserva mayúsculas/acentos: el valor del nombre va tal cual
    const named = /^(?:name|nombre)=(.+)$/i.exec(bare);
    if (named) {
      names.push(named[1]);
      continue;
    }
    const only = /^only=(.+)$/i.exec(bare);
    if (only) {
      addTargets(only[1]);
      continue;
    }
    if (arg.startsWith('-')) {
      const target = targetOf(key);
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

const TRUTHY = new Set(['1', 'true', 'yes', 'si', 'sí', '']);

/**
 * Pisado de precios pedido por entorno. Dos fuentes:
 *  - `BAREMOS_UPDATE_PRICES=1` (explícita, sirve en Docker/CI).
 *  - `npm_config_update_prices`: npm NO reenvía al script los argumentos que
 *    empiezan por `--` (avisa "Unknown cli config"), pero sí los expone como
 *    variables `npm_config_*`. Leerla hace que `npm run ... -- --update-prices`
 *    funcione igual que el token sin guiones.
 */
function envUpdatePrices(): boolean {
  const raw = (
    process.env.BAREMOS_UPDATE_PRICES ??
    process.env.npm_config_update_prices ??
    process.env.npm_config_actualizar_precios ??
    'no'
  )
    .trim()
    .toLowerCase();
  return TRUTHY.has(raw);
}

/**
 * Entrada CLI del seeder de baremos (separado del seed principal).
 * Uso: `npm run seed:baremos` (todos), `npm run seed:baremos:insurances`
 * (o `:doctors` / `:care-centers`), con `-- "<nombre>"` para uno solo y
 * `actualizar-precios` (sin guiones: npm se come los `--`) para pisar los
 * precios que cambiaron. `ayuda` lo explica.
 */
async function bootstrap() {
  const parsed = parseArgs(process.argv.slice(2));
  const { targets, names, help } = parsed;
  const updatePrices = parsed.updatePrices || envUpdatePrices();
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
  // qué base se está sembrando: con dos bloques DB_* en .env gana el último y
  // es fácil creer que el seed no hizo nada cuando escribió en la otra
  console.log(
    `Base de datos: ${process.env.DB_HOST ?? '?'}:${process.env.DB_PORT ?? '?'}/${process.env.DB_NAME ?? '?'}`,
  );
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
