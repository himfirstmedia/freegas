import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Order } from './Order';
import { GasCylinder } from './GasCylinder';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => GasCylinder, gasCylinder => gasCylinder.orderItems)
  gasCylinder: GasCylinder;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 8, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;
}