import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type FileOwnerType = 'order';

/**
 * Polimórfica: `ownerType`+`ownerId` referencian la entidad dueña (ej. Order).
 * `kind` clasifica el archivo dentro del owner (ej. 'order_report_attachment').
 * `storageProvider` ata la fila al backend usado al subirla — al cambiar de
 * proveedor (Vercel Blob → MinIO/S3) los archivos viejos siguen resolviendo.
 */
@Entity({ name: 'files' })
@Index('idx_files_owner', ['ownerType', 'ownerId'])
@Index('idx_files_uploaded_by', ['uploadedById'])
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, default: 'vercel_blob' })
  storageProvider: string;

  @Column({ type: 'text' })
  pathname: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  mimeType: string;

  @Column({ type: 'bigint' })
  sizeBytes: string;

  @Column({ type: 'varchar', length: 32 })
  ownerType: FileOwnerType;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  kind?: string | null;

  @Column({ type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
