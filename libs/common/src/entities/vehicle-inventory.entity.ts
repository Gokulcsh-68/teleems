import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('vehicle_inventories')
export class VehicleInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  @Index()
  vehicleId: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'item_id', type: 'uuid' })
  @Index()
  itemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ type: 'float', default: 0 })
  currentQuantity: number;

  @Column({ type: 'float', default: 0 })
  minRequiredQuantity: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRestockedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
