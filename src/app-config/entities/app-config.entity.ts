import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Configuración global del sistema en formato clave-valor. Pensado para
 * settings simples (porcentajes, flags) que un admin puede modificar desde
 * la UI sin requerir migración. Cada nuevo setting es una fila.
 */
@Entity({ name: 'app_config' })
export class AppConfig {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
