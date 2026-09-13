import { parseArgs } from '../../seed-baremos';

describe('parseArgs (CLI del seeder de baremos)', () => {
  it('sin argumentos corre los tres baremos, insert-only', () => {
    const a = parseArgs([]);
    expect(a.targets).toEqual(['insurances', 'doctors', 'care-centers']);
    expect(a.names).toEqual([]);
    expect(a.updatePrices).toBe(false);
  });

  it('lee el baremo, el nombre con coma y --update-prices juntos', () => {
    // llamada directa (npx ts-node src/seed-baremos.ts care-centers "CIMA, C.A" --update-prices)
    const a = parseArgs(['care-centers', 'CIMA, C.A', '--update-prices']);
    expect(a.targets).toEqual(['care-centers']);
    expect(a.names).toEqual(['CIMA, C.A']);
    expect(a.updatePrices).toBe(true);
  });

  // npm NUNCA reenvía los argumentos que empiezan por "--" (los toma como
  // config suya y avisa "Unknown cli config"), aunque vayan tras el "--"
  // separador. Con `npm run` sólo sobreviven los tokens SIN guiones, así que
  // ésa es la forma que tiene que activar el pisado de precios.
  it('acepta el flag sin guiones (única forma que sobrevive a npm run)', () => {
    // npm run seed:baremos:care-centers -- "CIMA, C.A" actualizar-precios
    const a = parseArgs(['care-centers', 'CIMA, C.A', 'actualizar-precios']);
    expect(a.targets).toEqual(['care-centers']);
    expect(a.names).toEqual(['CIMA, C.A']);
    expect(a.updatePrices).toBe(true);
  });

  it('acepta los demás sinónimos sin guiones del flag', () => {
    for (const token of [
      'update-prices',
      'updateprices',
      'pisar-precios',
      'pisar',
    ]) {
      expect(parseArgs(['care-centers', token]).updatePrices).toBe(true);
    }
  });

  it('el token sin guiones no se confunde con un nombre a filtrar', () => {
    expect(parseArgs(['care-centers', 'actualizar-precios']).names).toEqual([]);
  });

  it('nombre=... sin guiones conserva mayúsculas y acentos', () => {
    const a = parseArgs(['insurances', 'nombre=C.N.A SEGUROS LA PREVISORA']);
    expect(a.names).toEqual(['C.N.A SEGUROS LA PREVISORA']);
  });

  it('ayuda sin guiones equivale a --help', () => {
    expect(parseArgs(['ayuda']).help).toBe(true);
    expect(parseArgs(['--help']).help).toBe(true);
  });

  it('acepta el alias en español del flag', () => {
    expect(parseArgs(['seguros', '--actualizar-precios']).updatePrices).toBe(
      true,
    );
  });

  it('--name explícito y flag en cualquier orden', () => {
    const a = parseArgs([
      '--update-prices',
      'insurances',
      '--name',
      'SEGUROS VENEZUELA C.A',
    ]);
    expect(a.names).toEqual(['SEGUROS VENEZUELA C.A']);
    expect(a.updatePrices).toBe(true);
  });

  it('sin el flag no pisa precios', () => {
    expect(parseArgs(['care-centers', 'CIMA, C.A']).updatePrices).toBe(false);
  });
});
