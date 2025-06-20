// src/controllers/OrderController.ts
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Order, OrderStatus, PaymentStatus } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { User } from '../entities/User';
import { GasCylinder } from '../entities/GasCylinder';
import { log } from 'console';

export class OrderController {
  private orderRepository = AppDataSource.getRepository(Order);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);
  private userRepository = AppDataSource.getRepository(User);
  private gasCylinderRepository = AppDataSource.getRepository(GasCylinder);

  // Create new order
  async createOrder(req: Request, res: Response): Promise<Response> {
    try {
      // Remove excessive console.log for production, keep relevant ones for development/debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('--- Order Creation Request ---');
        // console.log('Request Body:', req.body);
      }

      const { 
        customerId, 
        items, 
        deliveryAddress, 
        deliveryLatitude, 
        deliveryLongitude, 
        specialInstructions 
      } = req.body;
      // console.log(req.body);
      

      // --- Input Validation ---
      // Consolidated validation for clarity
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required.' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required and must be a non-empty array.' });
      }
      if (!deliveryAddress || deliveryLatitude === undefined || deliveryLongitude === undefined) {
        return res.status(400).json({ error: 'Delivery address, latitude, and longitude are required.' });
      }

      // Find customer
      const customer = await this.userRepository.findOne({ 
        where: { id: customerId } 
      });
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found.' });
      }

      // Generate unique order number
      const orderNumber = await this.generateOrderNumber();

      let totalAmount = 0;
      const orderItemsData: any[] = []; // Explicitly type for better readability

      // --- Process each item ---
      for (const item of items) {
        const { cylinderId, quantity } = item;

        if (!cylinderId || !quantity || typeof quantity !== 'number' || quantity <= 0) {
          return res.status(400).json({ 
            error: 'Each item must have a valid cylinderId and a positive numeric quantity.' 
          });
        }

        const cylinder = await this.gasCylinderRepository.findOne({ 
          where: { id: cylinderId } 
        });
        
        if (!cylinder) {
          return res.status(404).json({ 
            error: `Gas cylinder with ID '${cylinderId}' not found.` 
          });
        }

        if (!cylinder.isAvailable) {
          return res.status(400).json({ 
            error: `Gas cylinder '${cylinder.name}' is not available.` 
          });
        }

        if (cylinder.stockQuantity < quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for '${cylinder.name}'. Available: ${cylinder.stockQuantity}, Requested: ${quantity}.` 
          });
        }

        const itemTotal = Number((cylinder.price * quantity).toFixed(2));
        totalAmount += itemTotal;

        orderItemsData.push({
          gasCylinder: cylinder,
          quantity,
          unitPrice: cylinder.price,
          totalPrice: itemTotal
        });
      }

      // Calculate delivery fee
      const deliveryFee = this.calculateDeliveryFee(deliveryLatitude, deliveryLongitude);
      totalAmount = Number((totalAmount + deliveryFee).toFixed(2));

      // --- Create Order Transactionally ---
      // Use a transaction to ensure atomicity for order creation and stock updates.
      // If any part fails, all changes are rolled back.
      const result = await AppDataSource.transaction(async transactionalEntityManager => {
        // Create order
        const order = transactionalEntityManager.create(Order, {
          orderNumber,
          customer,
          totalAmount,
          deliveryFee,
          deliveryAddress,
          deliveryLatitude,
          deliveryLongitude,
          specialInstructions: specialInstructions || null,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING
        });

        const savedOrder = await transactionalEntityManager.save(Order, order);

        // Create order items and update stock
        const createdOrderItems = [];
        for (const itemData of orderItemsData) {
          const orderItem = transactionalEntityManager.create(OrderItem, {
            order: savedOrder,
            gasCylinder: itemData.gasCylinder,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            totalPrice: itemData.totalPrice
          });

          const savedOrderItem = await transactionalEntityManager.save(OrderItem, orderItem);
          createdOrderItems.push(savedOrderItem);

          // Update stock quantity using the transactional entity manager
          await transactionalEntityManager.update(GasCylinder, itemData.gasCylinder.id, {
            stockQuantity: itemData.gasCylinder.stockQuantity - itemData.quantity
          });
        }

        // Fetch complete order with relations using the transactional entity manager
        const completeOrder = await transactionalEntityManager.findOne(Order, {
          where: { id: savedOrder.id },
          relations: ['customer', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
        });

        return completeOrder;
      });

      return res.status(201).json({
        message: 'Order created successfully',
        order: result,
        // Add these fields that the frontend expects
        orderNumber: result?.orderNumber,
        totalAmount: result?.totalAmount
      });

    } catch (error: any) { // Type 'error' as 'any' or 'unknown' for better type safety
      console.error('Error creating order:', error);
      // More specific error messages for common issues
      if (error.code === '23505') { // PostgreSQL unique violation error code
        return res.status(409).json({
          error: 'Duplicate order number or conflict detected.',
          details: process.env.NODE_ENV === 'development' ? error.detail : undefined
        });
      }
      return res.status(500).json({ 
        error: 'Failed to create order.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Get all orders with optional filtering
  async getAllOrders(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        status, 
        customerId, 
        driverId, 
        page = 1, 
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      let whereConditions: any = {};
      
      if (status) {
        whereConditions.status = status;
      }
      
      if (customerId) {
        whereConditions.customer = { id: customerId };
      }
      
      if (driverId) {
        whereConditions.driver = { id: driverId };
      }

      const [orders, total] = await this.orderRepository.findAndCount({
        where: whereConditions,
        relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier'],
        order: { [sortBy as string]: (sortOrder as string).toUpperCase() }, // Ensure sortOrder is uppercase
        skip,
        take
      });

      // Fix: Return the correct format that matches the frontend PaginatedResponse interface
      return res.json({
        data: orders, // Frontend expects 'data' not 'orders'
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });

    } catch (error: any) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch orders.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Get single order by ID
  async getOrderById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const order = await this.orderRepository.findOne({
        where: { id },
        relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      return res.json(order);

    } catch (error: any) {
      console.error('Error fetching order:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch order.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Update order status
  async updateOrderStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status, driverId, estimatedDeliveryTime } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
      }

      // Validate status
      if (!Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status provided.',
          validStatuses: Object.values(OrderStatus)
        });
      }

      const order = await this.orderRepository.findOne({ 
        where: { id },
        relations: ['customer', 'driver', 'items', 'items.gasCylinder'] // Added items and gasCylinder for restoreStockQuantities
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const updateData: any = { status };

      // Handle driver assignment
      if (driverId) {
        const driver = await this.userRepository.findOne({ 
          where: { id: driverId } 
        });
        
        if (!driver) {
          return res.status(404).json({ error: 'Driver not found.' });
        }
        
        updateData.driver = driver;
      }

      // Handle status-specific updates
      switch (status) {
        case OrderStatus.ASSIGNED:
          if (!driverId && !order.driver) {
            return res.status(400).json({ 
              error: 'Driver ID is required when assigning order if not already assigned.' 
            });
          }
          break;

        case OrderStatus.IN_TRANSIT:
          if (!order.driver) {
            return res.status(400).json({ 
              error: 'Order must be assigned to a driver before marking as in transit.' 
            });
          }
          break;

        case OrderStatus.DELIVERED:
          updateData.actualDeliveryTime = new Date();
          updateData.paymentStatus = PaymentStatus.PAID; // Assuming payment on delivery, adjust if different flow
          break;

        case OrderStatus.CANCELLED:
          // Restore stock quantities if the order was not already cancelled
          if (order.status !== OrderStatus.CANCELLED) {
            await this.restoreStockQuantities(order.id);
          }
          break;
      }

      if (estimatedDeliveryTime) {
        // Ensure estimatedDeliveryTime is a valid date string/format
        updateData.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
        if (isNaN(updateData.estimatedDeliveryTime)) {
          return res.status(400).json({ error: 'Invalid estimated delivery time format.' });
        }
      }

      await this.orderRepository.update(id, updateData);

      const updatedOrder = await this.orderRepository.findOne({
        where: { id },
        relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
      });

      return res.json({
        message: 'Order status updated successfully.',
        order: updatedOrder
      });

    } catch (error: any) {
      console.error('Error updating order status:', error);
      return res.status(500).json({ 
        error: 'Failed to update order status.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Update payment status
  async updatePaymentStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
        return res.status(400).json({ 
          error: 'Valid payment status is required.',
          validStatuses: Object.values(PaymentStatus)
        });
      }

      const order = await this.orderRepository.findOne({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      await this.orderRepository.update(id, { paymentStatus });

      const updatedOrder = await this.orderRepository.findOne({
        where: { id },
        relations: ['customer', 'driver', 'items', 'items.gasCylinder']
      });

      return res.json({
        message: 'Payment status updated successfully.',
        order: updatedOrder
      });

    } catch (error: any) {
      console.error('Error updating payment status:', error);
      return res.status(500).json({ 
        error: 'Failed to update payment status.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Cancel order
  async cancelOrder(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await this.orderRepository.findOne({ 
        where: { id },
        relations: ['items', 'items.gasCylinder']
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
        return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
      }

      // Restore stock quantities before updating the order status
      await this.restoreStockQuantities(id);

      // Update order status
      await this.orderRepository.update(id, {
        status: OrderStatus.CANCELLED,
        specialInstructions: reason ? `Cancelled: ${reason}` : 'Order cancelled.'
      });

      const cancelledOrder = await this.orderRepository.findOne({
        where: { id },
        relations: ['customer', 'driver', 'items', 'items.gasCylinder']
      });

      return res.json({
        message: 'Order cancelled successfully.',
        order: cancelledOrder
      });

    } catch (error: any) {
      console.error('Error cancelling order:', error);
      return res.status(500).json({ 
        error: 'Failed to cancel order.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
      });
    }
  }

  // Private helper methods
  private async generateOrderNumber(): Promise<string> {
    // Generate a more robust order number (e.g., check for uniqueness in database)
    let isUnique = false;
    let newOrderNumber: string;

    do {
      //const timestamp = Date.now();
      //const random = Math.floor(Math.random() * 9000) + 1000; // 4-digit random number
      //newOrderNumber = `GAS-${timestamp}-${random}`;
	const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits
	const random = Math.floor(Math.random() * 900) + 100; // 3-digit random
	newOrderNumber = `GAS-${shortTimestamp}-${random}`
      
	const existingOrder = await this.orderRepository.findOne({ where: { orderNumber: newOrderNumber } });
      if (!existingOrder) {
        isUnique = true;
      }
    } while (!isUnique);

    return newOrderNumber;
  }

  private calculateDeliveryFee(latitude: number, longitude: number): number {
    // Simple delivery fee calculation
    // In a real application, this could be based on distance, location zones, etc.
    const baseFee = 0.00;
    
    // You could implement distance-based pricing here using the provided latitude and longitude.
    // For now, returning a fixed fee.
    return baseFee;
  }

  private async restoreStockQuantities(orderId: string): Promise<void> {
    const orderItems = await this.orderItemRepository.find({
      where: { order: { id: orderId } },
      relations: ['gasCylinder']
    });

    for (const item of orderItems) {
      // Ensure we are working with the latest stock quantity before updating
      const currentCylinder = await this.gasCylinderRepository.findOne({ where: { id: item.gasCylinder.id } });
      if (currentCylinder) {
        await this.gasCylinderRepository.update(item.gasCylinder.id, {
          stockQuantity: currentCylinder.stockQuantity + item.quantity
        });
      } else {
        console.warn(`Gas cylinder with ID ${item.gasCylinder.id} not found when trying to restore stock.`);
      }
    }
  }

  // Delete order
  async deleteOrder(req: Request, res: Response): Promise<Response> {
    try {
      const { orderId } = req.params;

      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items'], // Include items to ensure they are handled if needed, though direct deletion is separate
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        return res.status(400).json({
          error: 'Only cancelled orders can be deleted.',
          currentStatus: order.status,
        });
      }

      // Use a transaction to ensure atomicity
      await AppDataSource.transaction(async transactionalEntityManager => {
        // Delete all associated OrderItem entities
        // It's important to delete related OrderItems first to avoid foreign key constraints
        await transactionalEntityManager.delete(OrderItem, { order: { id: orderId } });

        // Delete the Order entity itself
        await transactionalEntityManager.delete(Order, orderId);
      });

      return res.status(200).json({ message: 'Order deleted successfully.' });

    } catch (error: any) {
      console.error('Error deleting order:', error);
      // Provide more context in development for easier debugging
      const errorMessage = process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred while deleting the order.';

      return res.status(500).json({
        error: 'Failed to delete order.',
        details: errorMessage,
      });
    }
  }
}
