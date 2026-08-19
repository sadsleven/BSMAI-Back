/**
 * `true` cuando el proceso corre en un entorno serverless (Vercel, AWS Lambda).
 *
 * En serverless no existe un proceso de larga vida: cada request levanta y
 * congela una instancia, así que los cron de `@nestjs/schedule` no se ejecutan
 * de forma confiable (y cuando lo hacen, se duplican entre instancias). Todo
 * trabajo agendado debe consultar esto antes de registrarse.
 *
 * En Docker / bare metal devuelve `false` → los cron sí corren.
 */
export function isServerlessRuntime(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}
