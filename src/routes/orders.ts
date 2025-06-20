// src/routes/orders.ts
import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';

const router = Router();
const orderController = new OrderController();

// POST /api/orders - Create new order
router.post('/', orderController.createOrder.bind(orderController));

// GET /api/orders - Get all orders (with optional filtering and pagination)
router.get('/', orderController.getAllOrders.bind(orderController));

// GET /api/orders/:id - Get single order by ID
router.get('/:id', orderController.getOrderById.bind(orderController));

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', orderController.updateOrderStatus.bind(orderController));

// PUT /api/orders/:id/payment - Update payment status
router.put('/:id/payment', orderController.updatePaymentStatus.bind(orderController));

// PUT /api/orders/:id/cancel - Cancel order
router.put('/:id/cancel', orderController.cancelOrder.bind(orderController));

// DELETE /api/orders/:orderId - Delete an order
router.delete('/:orderId', orderController.deleteOrder.bind(orderController));

export default router;