import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum InventoryCategory {
  EQUIPMENT = 'EQUIPMENT',
  CONSUMABLE = 'CONSUMABLE',
  MEDICATION = 'MEDICATION',
  SAFETY = 'SAFETY'
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: InventoryCategory,
    default: InventoryCategory.CONSUMABLE
  })
  category: InventoryCategory;

  @Column({ nullable: true })
  unit: string; // e.g., "Liters", "Pieces", "Packets"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
