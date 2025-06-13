// src/routes/orders.ts
import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { User } from '../entities/User';
import { GasCylinder } from '../entities/GasCylinder';

const router = Router();
const orderRepository = AppDataSource.getRepository(Order);
const orderItemRepository = AppDataSource.getRepository(OrderItem);
const userRepository = AppDataSource.getRepository(User);
const gasCylinderRepository = AppDataSource.getRepository(GasCylinder);

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
  try {
    const { customerId, items, deliveryAddress, deliveryLatitude, deliveryLongitude, specialInstructions } = req.body;
    
    const customer = await userRepository.findOne({ where: { id: customerId } });
    if (!customer) {
      return res.status(400).json({ error: 'Customer not found' });
    }
    
    // Generate order number
    const orderNumber = `GAS-${Date.now()}`;
    
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const cylinder = await gasCylinderRepository.findOne({ where: { id: item.cylinderId } });
      if (!cylinder) {
        return res.status(400).json({ error: `Gas cylinder ${item.cylinderId} not found` });
      }
      
      if (cylinder.stockQuantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${cylinder.name}` });
      }
      
      const itemTotal = cylinder.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        gasCylinder: cylinder,
        quantity: item.quantity,
        unitPrice: cylinder.price,
        totalPrice: itemTotal
      });
    }
    
    const deliveryFee = 5.00; // Fixed delivery fee
    totalAmount += deliveryFee;
    
    const order = orderRepository.create({
      orderNumber,
      customer,
      totalAmount,
      deliveryFee,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      specialInstructions
    });
    
    const savedOrder = await orderRepository.save(order);
    
    // Create order items
    for (const itemData of orderItems) {
      const orderItem = orderItemRepository.create({
        order: savedOrder,
        gasCylinder: itemData.gasCylinder,
        quantity: itemData.quantity,
        unitPrice: itemData.unitPrice,
        totalPrice: itemData.totalPrice
      });
      await orderItemRepository.save(orderItem);
      
      // Update stock
      await gasCylinderRepository.update(itemData.gasCylinder.id, {
        stockQuantity: itemData.gasCylinder.stockQuantity - itemData.quantity
      });
    }
    
    const completeOrder = await orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['customer', 'items', 'items.gasCylinder']
    });
    
    res.status(201).json(completeOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await orderRepository.find({
      relations: ['customer', 'driver', 'items', 'items.gasCylinder'],
      order: { createdAt: 'DESC' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, driverId } = req.body;
    
    const order = await orderRepository.findOne({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const updateData: any = { status };
    
    if (driverId) {
      const driver = await userRepository.findOne({ where: { id: driverId } });
      if (!driver) {
        return res.status(400).json({ error: 'Driver not found' });
      }
      updateData.driver = driver;
    }
    
    if (status === OrderStatus.DELIVERED) {
      updateData.actualDeliveryTime = new Date();
    }
    
    await orderRepository.update(req.params.id, updateData);
    
    const updatedOrder = await orderRepository.findOne({
      where: { id: req.params.id },
      relations: ['customer', 'driver', 'items', 'items.gasCylinder']
    });
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;