import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryItemMaster } from './inventory-item-master.entity';
import { Organisation } from './organisation.entity';

@Entity('warehouse_inventory')
@Index(['organisation_id', 'inventory_item_id'], { unique: true })
export class WarehouseInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  @Index()
  organisation_id: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisation_id' })
  organisation: Organisation;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  @Index()
  inventory_item_id: string;

  @ManyToOne(() => InventoryItemMaster)
  @JoinColumn({ name: 'inventory_item_id' })
  item_master: InventoryItemMaster;

  @Column({ type: 'float', default: 0 })
  quantity: number;

  @Column({ type: 'float', default: 0 })
  min_required_quantity: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
