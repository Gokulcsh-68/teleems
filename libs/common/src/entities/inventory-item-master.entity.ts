import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InventoryItemCategory {
  DISPOSABLE = 'DISPOSABLE',
  MEDICAL_DEVICE = 'MEDICAL_DEVICE',
  DRUG = 'DRUG',
  MEDICATION = 'MEDICATION',
  REUSABLE = 'REUSABLE',
}

@Entity('inventory_item_master')
export class InventoryItemMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: InventoryItemCategory,
    default: InventoryItemCategory.DISPOSABLE,
  })
  category: InventoryItemCategory;

  @Column({ nullable: true })
  unit_of_measure: string; // ml, tablets, pieces, etc.

  @Column({ nullable: true })
  hsn_code: string;

  @Column({ default: false })
  gstin_applicable: boolean;

  @Column({ type: 'int', default: 10 })
  min_stock_threshold: number;

  @Column({ type: 'int', nullable: true })
  max_stock_level: number;

  @Column({ default: false })
  is_expiry_tracked: boolean;

  @Column({ default: false })
  batch_number_required: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  supplier_details: string;

  @Column({ type: 'int', nullable: true })
  lead_time_days: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
