import {
  computePayableSummary,
  emptyPayableSummary,
  groupPayablesByProvider,
  payableProviderKey,
  type PayableLoteMaps,
  type PayableObligationRef,
  type PayableRowAmounts,
} from './payables-math';

/**
 * Escenario base: dos proveedores.
 *
 * - DR. GRANADO: un lote (L1) con dos órdenes de 400 y 15 USD, con un abono
 *   parcial de 300 USD, más una orden suelta de 5 USD que aún no entró a
 *   ningún lote.
 * - CENTRO RX: un lote (L2) de 20 USD ya pagado por completo.
 */
function obligacion(
  partial: Partial<PayableObligationRef> & { orderId: string },
): PayableObligationRef {
  return {
    providerType: 'doctor',
    doctorId: 'doc-1',
    careCenterId: null,
    providerName: 'DR. GRANADO',
    payableId: null,
    payableStatus: null,
    ...partial,
  };
}

const OBLIGACIONES: PayableObligationRef[] = [
  obligacion({ orderId: 'o1', payableId: 'L1', payableStatus: 'partially_paid' }),
  obligacion({ orderId: 'o2', payableId: 'L1', payableStatus: 'partially_paid' }),
  obligacion({ orderId: 'o3' }), // sin lote
  obligacion({
    orderId: 'o4',
    providerType: 'care_center',
    doctorId: null,
    careCenterId: 'cc-1',
    providerName: 'CENTRO RX',
    payableId: 'L2',
    payableStatus: 'paid',
  }),
];

/** Bruto/neto ya resuelto de cada obligación, en el mismo orden. */
const MONTOS: PayableRowAmounts[] = [
  { grossUsd: 400, grossBs: 40000, netBs: 39000 },
  { grossUsd: 15, grossBs: 1500, netBs: 1470 },
  { grossUsd: 5, grossBs: 500, netBs: 485 },
  { grossUsd: 20, grossBs: 2000, netBs: 1940 },
];

function mapas(): PayableLoteMaps {
  return {
    // L1 lleva 30.000 Bs pagados de 40.600 netos; L2 está saldado.
    paidByPayable: new Map([
      ['L1', 30000],
      ['L2', 1940],
    ]),
    loteGrossBs: new Map([
      ['L1', 41500],
      ['L2', 2000],
    ]),
    loteGrossUsd: new Map([
      ['L1', 415],
      ['L2', 20],
    ]),
    loteNetBs: new Map([
      ['L1', 40600],
      ['L2', 1940],
    ]),
    loteCoveredUsd: new Map([
      ['L1', 300],
      ['L2', 20],
    ]),
  };
}

describe('payableProviderKey', () => {
  it('agrupa por doctor', () => {
    expect(
      payableProviderKey({
        providerType: 'doctor',
        doctorId: 'doc-1',
        careCenterId: null,
      }),
    ).toBe('doctor:doc-1');
  });

  it('agrupa por centro', () => {
    expect(
      payableProviderKey({
        providerType: 'care_center',
        doctorId: null,
        careCenterId: 'cc-1',
      }),
    ).toBe('cc:cc-1');
  });
});

describe('computePayableSummary', () => {
  it('sin obligaciones devuelve todo en cero', () => {
    const vacio = emptyPayableSummary();
    expect(vacio).toEqual({
      count: 0,
      grossUsd: 0,
      grossBs: 0,
      netBs: 0,
      paidBs: 0,
      pendingBs: 0,
    });
  });

  it('suma el bruto de TODAS las obligaciones', () => {
    const ctx = mapas();
    const s = computePayableSummary(OBLIGACIONES, {
      ...ctx,
      perObligationRows: MONTOS,
    });
    expect(s.count).toBe(4);
    expect(s.grossUsd).toBe(440); // 400 + 15 + 5 + 20
    expect(s.grossBs).toBe(44000); // 40000 + 1500 + 500 + 2000
  });

  it('el neto del lote se cuenta UNA sola vez, no por orden', () => {
    const ctx = mapas();
    const s = computePayableSummary(OBLIGACIONES, {
      ...ctx,
      perObligationRows: MONTOS,
    });
    // L1 (40.600) + L2 (1.940) + la suelta (485). Si se sumara el neto
    // estimado de o1 y o2 por separado darían 40.470 y no cuadraría.
    expect(s.netBs).toBe(43025);
  });

  it('pendiente = saldo de los lotes no pagados + las obligaciones sin lote', () => {
    const ctx = mapas();
    const s = computePayableSummary(OBLIGACIONES, {
      ...ctx,
      perObligationRows: MONTOS,
    });
    expect(s.paidBs).toBe(31940); // 30.000 de L1 + 1.940 de L2
    // L1: 40.600 − 30.000 = 10.600. L2 está pagado, no aporta. Suelta: 485.
    expect(s.pendingBs).toBe(11085);
  });

  it('un lote pagado nunca aporta pendiente, aunque los pagos no cuadren', () => {
    const ctx = mapas();
    // Se marca como pagado pero quedó registrado menos dinero del neto.
    ctx.paidByPayable.set('L2', 1000);
    const s = computePayableSummary(
      [OBLIGACIONES[3]],
      { ...ctx, perObligationRows: [MONTOS[3]] },
    );
    expect(s.pendingBs).toBe(0);
  });

  it('nunca devuelve pendiente negativo si se pagó de más', () => {
    const ctx = mapas();
    ctx.paidByPayable.set('L1', 99999);
    const s = computePayableSummary(
      [OBLIGACIONES[0], OBLIGACIONES[1]],
      { ...ctx, perObligationRows: [MONTOS[0], MONTOS[1]] },
    );
    expect(s.pendingBs).toBe(0);
  });
});

describe('groupPayablesByProvider', () => {
  it('arma una fila por proveedor con sus conteos', () => {
    const filas = groupPayablesByProvider(OBLIGACIONES, MONTOS, mapas());
    expect(filas).toHaveLength(2);

    const granado = filas.find((f) => f.providerName === 'DR. GRANADO')!;
    expect(granado.providerType).toBe('doctor');
    expect(granado.providerId).toBe('doc-1');
    expect(granado.ordersCount).toBe(3);
    expect(granado.lotesCount).toBe(1); // la orden suelta no suma lote

    const centro = filas.find((f) => f.providerName === 'CENTRO RX')!;
    expect(centro.providerType).toBe('care_center');
    expect(centro.providerId).toBe('cc-1');
    expect(centro.lotesCount).toBe(1);
  });

  it('en USD el saldo sale de lo abonado, no del estado del lote', () => {
    const filas = groupPayablesByProvider(OBLIGACIONES, MONTOS, mapas());
    const granado = filas.find((f) => f.providerName === 'DR. GRANADO')!;
    expect(granado.grossUsd).toBe(420); // 400 + 15 + 5
    expect(granado.paidUsd).toBe(300); // el abono parcial de L1
    // L1 debe 415 − 300 = 115, más los 5 de la orden sin lote.
    expect(granado.pendingUsd).toBe(120);
  });

  it('un lote saldado deja el pendiente en cero', () => {
    const filas = groupPayablesByProvider(OBLIGACIONES, MONTOS, mapas());
    const centro = filas.find((f) => f.providerName === 'CENTRO RX')!;
    expect(centro.grossUsd).toBe(20);
    expect(centro.paidUsd).toBe(20);
    expect(centro.pendingUsd).toBe(0);
    expect(centro.pendingBs).toBe(0);
  });

  it('no cuenta dos veces el abono de un lote con varias órdenes', () => {
    const filas = groupPayablesByProvider(OBLIGACIONES, MONTOS, mapas());
    const granado = filas.find((f) => f.providerName === 'DR. GRANADO')!;
    // L1 tiene dos órdenes: si el abono se contara por fila daría 600.
    expect(granado.paidUsd).toBe(300);
    expect(granado.paidBs).toBe(30000);
  });

  it('ordena de mayor a menor por lo que falta pagar', () => {
    const filas = groupPayablesByProvider(OBLIGACIONES, MONTOS, mapas());
    expect(filas.map((f) => f.providerName)).toEqual([
      'DR. GRANADO',
      'CENTRO RX',
    ]);
    expect(filas[0].pendingUsd).toBeGreaterThan(filas[1].pendingUsd);
  });

  it('desempata por bruto cuando dos proveedores no deben nada', () => {
    const obligaciones: PayableObligationRef[] = [
      obligacion({
        orderId: 'a',
        doctorId: 'chico',
        providerName: 'CHICO',
        payableId: 'LA',
        payableStatus: 'paid',
      }),
      obligacion({
        orderId: 'b',
        doctorId: 'grande',
        providerName: 'GRANDE',
        payableId: 'LB',
        payableStatus: 'paid',
      }),
    ];
    const montos: PayableRowAmounts[] = [
      { grossUsd: 10, grossBs: 1000, netBs: 1000 },
      { grossUsd: 900, grossBs: 90000, netBs: 90000 },
    ];
    const ctx: PayableLoteMaps = {
      paidByPayable: new Map([
        ['LA', 1000],
        ['LB', 90000],
      ]),
      loteGrossBs: new Map([
        ['LA', 1000],
        ['LB', 90000],
      ]),
      loteGrossUsd: new Map([
        ['LA', 10],
        ['LB', 900],
      ]),
      loteNetBs: new Map([
        ['LA', 1000],
        ['LB', 90000],
      ]),
      loteCoveredUsd: new Map([
        ['LA', 10],
        ['LB', 900],
      ]),
    };
    const filas = groupPayablesByProvider(obligaciones, montos, ctx);
    expect(filas.map((f) => f.providerName)).toEqual(['GRANDE', 'CHICO']);
  });

  it('una obligación sin lote cuenta completa como pendiente', () => {
    const filas = groupPayablesByProvider(
      [OBLIGACIONES[2]],
      [MONTOS[2]],
      mapas(),
    );
    expect(filas[0].lotesCount).toBe(0);
    expect(filas[0].paidUsd).toBe(0);
    expect(filas[0].pendingUsd).toBe(5);
    expect(filas[0].pendingBs).toBe(485);
  });

  it('proveedor sin nombre cae a un guion, no a undefined', () => {
    const filas = groupPayablesByProvider(
      [obligacion({ orderId: 'x', providerName: null })],
      [{ grossUsd: 1, grossBs: 10, netBs: 10 }],
      mapas(),
    );
    expect(filas[0].providerName).toBe('—');
  });

  it('redondea a dos decimales y no arrastra error flotante', () => {
    const obligaciones = [
      obligacion({ orderId: 'c1', payableId: 'LC', payableStatus: 'unpaid' }),
    ];
    const montos: PayableRowAmounts[] = [
      { grossUsd: 0.1, grossBs: 0.1, netBs: 0.1 },
    ];
    const ctx: PayableLoteMaps = {
      paidByPayable: new Map(),
      loteGrossBs: new Map([['LC', 0.1]]),
      loteGrossUsd: new Map([['LC', 0.1]]),
      loteNetBs: new Map([['LC', 0.1]]),
      loteCoveredUsd: new Map([['LC', 0.02]]),
    };
    const filas = groupPayablesByProvider(obligaciones, montos, ctx);
    // 0.1 − 0.02 = 0.08000000000000002 en coma flotante.
    expect(filas[0].pendingUsd).toBe(0.08);
  });

  it('el reporte vacío no devuelve filas', () => {
    expect(groupPayablesByProvider([], [], mapas())).toEqual([]);
  });
});
