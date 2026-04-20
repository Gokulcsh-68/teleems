import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryItemMaster } from './inventory-item-master.entity';

@Entity('vehicle_inventory')
@Index(['vehicle_id', 'inventory_item_id'], { unique: true })
export class VehicleInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  vehicle_id: string;

  @Column({ type: 'uuid' })
  @Index()
  inventory_item_id: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_replenished_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => InventoryItemMaster)
  @JoinColumn({ name: 'inventory_item_id' })
  item_master: InventoryItemMaster;
}
