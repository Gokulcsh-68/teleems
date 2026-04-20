import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { InventoryItemMaster } from './inventory-item-master.entity';

@Entity('vehicle_inventory')
@Index(['vehicle_id', 'inventory_item_id'], { unique: true })
export class VehicleInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
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

  @Column({ type: 'float', default: 0 })
  quantity: number;

  @Column({ type: 'float', default: 0 })
  min_required_quantity: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_replenished_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
