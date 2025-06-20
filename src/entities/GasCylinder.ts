import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { OrderItem } from './OrderItem';
import { Supplier } from './Supplier';

@Entity('gas_cylinders')
export class GasCylinder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 5, scale: 2 })
  weight: number; // Weight in kg (e.g., 5.00, 12.50, 14.20, 19.00)

  @Column('decimal', { precision: 8, scale: 2 })
  price: number;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  brand: string;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: 0 })
  stockQuantity: number;

  @Column({ nullable: true })
  imageUrl: string;

  @ManyToOne(() => Supplier, supplier => supplier.gasCylinders)
  supplier: Supplier;

  @OneToMany(() => OrderItem, orderItem => orderItem.gasCylinder)
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
