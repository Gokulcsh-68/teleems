import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { InventoryItemMaster } from './inventory-item-master.entity';

export enum InventoryLogType {
  RESTOCK = 'RESTOCK',
  USAGE = 'USAGE',
  CORRECTION = 'CORRECTION',
  EXPIRY_DISCARD = 'EXPIRY_DISCARD'
}

@Entity('inventory_logs')
export class InventoryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  @Index()
  vehicle_id: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  @Index()
  inventory_item_id: string;

  @ManyToOne(() => InventoryItemMaster)
  @JoinColumn({ name: 'inventory_item_id' })
  item_master: InventoryItemMaster;

  @Column({ type: 'float' })
  previous_quantity: number;

  @Column({ type: 'float' })
  new_quantity: number;

  @Column({ type: 'float' })
  change_amount: number;

  @Column({
    type: 'enum',
    enum: InventoryLogType,
    default: InventoryLogType.CORRECTION
  })
  log_type: InventoryLogType;

  @Column({ name: 'performed_by_id', type: 'uuid', nullable: true })
  @Index()
  performed_by_id: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  batch_number: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiry_date: Date;

  @Column({ nullable: true })
  supplier_name: string;

  @Column({ nullable: true })
  invoice_number: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
