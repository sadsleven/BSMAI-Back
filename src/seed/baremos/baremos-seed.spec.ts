import { selectBaremos } from './baremos-seed.service';

describe('selectBaremos', () => {
  it('sin filtro devuelve todos los baremos', () => {
    const all = selectBaremos(['insurances', 'doctors', 'care-centers']);
    expect(all.insurances.length).toBeGreaterThan(1);
    expect(all.centers.length).toBeGreaterThan(1);
  });

  it('filtra un seguro por su razón social', () => {
    const { insurances } = selectBaremos(
      ['insurances'],
      ['SEGUROS VENEZUELA C.A'],
    );
    expect(insurances.map((i) => i.name)).toEqual(['SEGUROS VENEZUELA C.A']);
  });

  it('ignora acentos, puntuación y mayúsculas, y acepta subcadenas', () => {
    const { insurances } = selectBaremos(['insurances'], ['previsora']);
    expect(insurances.map((i) => i.name)).toEqual([
      'C.N.A SEGUROS LA PREVISORA',
    ]);
  });

  it('filtra un centro de atención por su razón social', () => {
    const { centers } = selectBaremos(['care-centers'], ['CIMA']);
    expect(centers.map((c) => c.businessName)).toEqual(['CIMA, C.A']);
  });

  it('acepta varios nombres a la vez', () => {
    const { insurances } = selectBaremos(
      ['insurances'],
      ['venezuela', 'piramide'],
    );
    expect(insurances).toHaveLength(2);
  });

  it('falla listando los disponibles si el nombre no existe', () => {
    expect(() => selectBaremos(['insurances'], ['NO EXISTE'])).toThrow(
      /Ningún baremo coincide.*SEGUROS VENEZUELA C\.A/s,
    );
  });

  it('el filtro sólo aplica a los baremos seleccionados', () => {
    // "CIMA" es un centro: pedir sólo seguros con ese nombre no alcanza a nadie
    expect(() => selectBaremos(['insurances'], ['CIMA'])).toThrow(
      /Ningún baremo coincide/,
    );
  });
});
