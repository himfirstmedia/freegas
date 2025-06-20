"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const database_1 = require("../config/database");
const Order_1 = require("../entities/Order");
const OrderItem_1 = require("../entities/OrderItem");
const User_1 = require("../entities/User");
const GasCylinder_1 = require("../entities/GasCylinder");
class OrderController {
    constructor() {
        this.orderRepository = database_1.AppDataSource.getRepository(Order_1.Order);
        this.orderItemRepository = database_1.AppDataSource.getRepository(OrderItem_1.OrderItem);
        this.userRepository = database_1.AppDataSource.getRepository(User_1.User);
        this.gasCylinderRepository = database_1.AppDataSource.getRepository(GasCylinder_1.GasCylinder);
    }
    // Create new order
    createOrder(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Remove excessive console.log for production, keep relevant ones for development/debugging
                if (process.env.NODE_ENV === 'development') {
                    console.log('--- Order Creation Request ---');
                    // console.log('Request Body:', req.body);
                }
                const { customerId, items, deliveryAddress, deliveryLatitude, deliveryLongitude, specialInstructions } = req.body;
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
                const customer = yield this.userRepository.findOne({
                    where: { id: customerId }
                });
                if (!customer) {
                    return res.status(404).json({ error: 'Customer not found.' });
                }
                // Generate unique order number
                const orderNumber = yield this.generateOrderNumber();
                let totalAmount = 0;
                const orderItemsData = []; // Explicitly type for better readability
                // --- Process each item ---
                for (const item of items) {
                    const { cylinderId, quantity } = item;
                    if (!cylinderId || !quantity || typeof quantity !== 'number' || quantity <= 0) {
                        return res.status(400).json({
                            error: 'Each item must have a valid cylinderId and a positive numeric quantity.'
                        });
                    }
                    const cylinder = yield this.gasCylinderRepository.findOne({
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
                const result = yield database_1.AppDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                    // Create order
                    const order = transactionalEntityManager.create(Order_1.Order, {
                        orderNumber,
                        customer,
                        totalAmount,
                        deliveryFee,
                        deliveryAddress,
                        deliveryLatitude,
                        deliveryLongitude,
                        specialInstructions: specialInstructions || null,
                        status: Order_1.OrderStatus.PENDING,
                        paymentStatus: Order_1.PaymentStatus.PENDING
                    });
                    const savedOrder = yield transactionalEntityManager.save(Order_1.Order, order);
                    // Create order items and update stock
                    const createdOrderItems = [];
                    for (const itemData of orderItemsData) {
                        const orderItem = transactionalEntityManager.create(OrderItem_1.OrderItem, {
                            order: savedOrder,
                            gasCylinder: itemData.gasCylinder,
                            quantity: itemData.quantity,
                            unitPrice: itemData.unitPrice,
                            totalPrice: itemData.totalPrice
                        });
                        const savedOrderItem = yield transactionalEntityManager.save(OrderItem_1.OrderItem, orderItem);
                        createdOrderItems.push(savedOrderItem);
                        // Update stock quantity using the transactional entity manager
                        yield transactionalEntityManager.update(GasCylinder_1.GasCylinder, itemData.gasCylinder.id, {
                            stockQuantity: itemData.gasCylinder.stockQuantity - itemData.quantity
                        });
                    }
                    // Fetch complete order with relations using the transactional entity manager
                    const completeOrder = yield transactionalEntityManager.findOne(Order_1.Order, {
                        where: { id: savedOrder.id },
                        relations: ['customer', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
                    });
                    return completeOrder;
                }));
                return res.status(201).json({
                    message: 'Order created successfully',
                    order: result,
                    // Add these fields that the frontend expects
                    orderNumber: result === null || result === void 0 ? void 0 : result.orderNumber,
                    totalAmount: result === null || result === void 0 ? void 0 : result.totalAmount
                });
            }
            catch (error) { // Type 'error' as 'any' or 'unknown' for better type safety
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
        });
    }
    // Get all orders with optional filtering
    getAllOrders(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { status, customerId, driverId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
                const skip = (Number(page) - 1) * Number(limit);
                const take = Number(limit);
                let whereConditions = {};
                if (status) {
                    whereConditions.status = status;
                }
                if (customerId) {
                    whereConditions.customer = { id: customerId };
                }
                if (driverId) {
                    whereConditions.driver = { id: driverId };
                }
                const [orders, total] = yield this.orderRepository.findAndCount({
                    where: whereConditions,
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier'],
                    order: { [sortBy]: sortOrder.toUpperCase() }, // Ensure sortOrder is uppercase
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
            }
            catch (error) {
                console.error('Error fetching orders:', error);
                return res.status(500).json({
                    error: 'Failed to fetch orders.',
                    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
                });
            }
        });
    }
    // Get single order by ID
    getOrderById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const order = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
                });
                if (!order) {
                    return res.status(404).json({ error: 'Order not found.' });
                }
                return res.json(order);
            }
            catch (error) {
                console.error('Error fetching order:', error);
                return res.status(500).json({
                    error: 'Failed to fetch order.',
                    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
                });
            }
        });
    }
    // Update order status
    updateOrderStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { status, driverId, estimatedDeliveryTime } = req.body;
                if (!status) {
                    return res.status(400).json({ error: 'Status is required.' });
                }
                // Validate status
                if (!Object.values(Order_1.OrderStatus).includes(status)) {
                    return res.status(400).json({
                        error: 'Invalid status provided.',
                        validStatuses: Object.values(Order_1.OrderStatus)
                    });
                }
                const order = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder'] // Added items and gasCylinder for restoreStockQuantities
                });
                if (!order) {
                    return res.status(404).json({ error: 'Order not found.' });
                }
                const updateData = { status };
                // Handle driver assignment
                if (driverId) {
                    const driver = yield this.userRepository.findOne({
                        where: { id: driverId }
                    });
                    if (!driver) {
                        return res.status(404).json({ error: 'Driver not found.' });
                    }
                    updateData.driver = driver;
                }
                // Handle status-specific updates
                switch (status) {
                    case Order_1.OrderStatus.ASSIGNED:
                        if (!driverId && !order.driver) {
                            return res.status(400).json({
                                error: 'Driver ID is required when assigning order if not already assigned.'
                            });
                        }
                        break;
                    case Order_1.OrderStatus.IN_TRANSIT:
                        if (!order.driver) {
                            return res.status(400).json({
                                error: 'Order must be assigned to a driver before marking as in transit.'
                            });
                        }
                        break;
                    case Order_1.OrderStatus.DELIVERED:
                        updateData.actualDeliveryTime = new Date();
                        updateData.paymentStatus = Order_1.PaymentStatus.PAID; // Assuming payment on delivery, adjust if different flow
                        break;
                    case Order_1.OrderStatus.CANCELLED:
                        // Restore stock quantities if the order was not already cancelled
                        if (order.status !== Order_1.OrderStatus.CANCELLED) {
                            yield this.restoreStockQuantities(order.id);
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
                yield this.orderRepository.update(id, updateData);
                const updatedOrder = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder', 'items.gasCylinder.supplier']
                });
                return res.json({
                    message: 'Order status updated successfully.',
                    order: updatedOrder
                });
            }
            catch (error) {
                console.error('Error updating order status:', error);
                return res.status(500).json({
                    error: 'Failed to update order status.',
                    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
                });
            }
        });
    }
    // Update payment status
    updatePaymentStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { paymentStatus } = req.body;
                if (!paymentStatus || !Object.values(Order_1.PaymentStatus).includes(paymentStatus)) {
                    return res.status(400).json({
                        error: 'Valid payment status is required.',
                        validStatuses: Object.values(Order_1.PaymentStatus)
                    });
                }
                const order = yield this.orderRepository.findOne({ where: { id } });
                if (!order) {
                    return res.status(404).json({ error: 'Order not found.' });
                }
                yield this.orderRepository.update(id, { paymentStatus });
                const updatedOrder = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder']
                });
                return res.json({
                    message: 'Payment status updated successfully.',
                    order: updatedOrder
                });
            }
            catch (error) {
                console.error('Error updating payment status:', error);
                return res.status(500).json({
                    error: 'Failed to update payment status.',
                    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
                });
            }
        });
    }
    // Cancel order
    cancelOrder(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { reason } = req.body;
                const order = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['items', 'items.gasCylinder']
                });
                if (!order) {
                    return res.status(404).json({ error: 'Order not found.' });
                }
                if (order.status !== Order_1.OrderStatus.PENDING && order.status !== Order_1.OrderStatus.CONFIRMED) {
                    return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
                }
                // Restore stock quantities before updating the order status
                yield this.restoreStockQuantities(id);
                // Update order status
                yield this.orderRepository.update(id, {
                    status: Order_1.OrderStatus.CANCELLED,
                    specialInstructions: reason ? `Cancelled: ${reason}` : 'Order cancelled.'
                });
                const cancelledOrder = yield this.orderRepository.findOne({
                    where: { id },
                    relations: ['customer', 'driver', 'items', 'items.gasCylinder']
                });
                return res.json({
                    message: 'Order cancelled successfully.',
                    order: cancelledOrder
                });
            }
            catch (error) {
                console.error('Error cancelling order:', error);
                return res.status(500).json({
                    error: 'Failed to cancel order.',
                    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
                });
            }
        });
    }
    // Private helper methods
    generateOrderNumber() {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a more robust order number (e.g., check for uniqueness in database)
            let isUnique = false;
            let newOrderNumber;
            do {
                //const timestamp = Date.now();
                //const random = Math.floor(Math.random() * 9000) + 1000; // 4-digit random number
                //newOrderNumber = `GAS-${timestamp}-${random}`;
                const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits
                const random = Math.floor(Math.random() * 900) + 100; // 3-digit random
                newOrderNumber = `GAS-${shortTimestamp}-${random}`;
                const existingOrder = yield this.orderRepository.findOne({ where: { orderNumber: newOrderNumber } });
                if (!existingOrder) {
                    isUnique = true;
                }
            } while (!isUnique);
            return newOrderNumber;
        });
    }
    calculateDeliveryFee(latitude, longitude) {
        // Simple delivery fee calculation
        // In a real application, this could be based on distance, location zones, etc.
        const baseFee = 0.00;
        // You could implement distance-based pricing here using the provided latitude and longitude.
        // For now, returning a fixed fee.
        return baseFee;
    }
    restoreStockQuantities(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderItems = yield this.orderItemRepository.find({
                where: { order: { id: orderId } },
                relations: ['gasCylinder']
            });
            for (const item of orderItems) {
                // Ensure we are working with the latest stock quantity before updating
                const currentCylinder = yield this.gasCylinderRepository.findOne({ where: { id: item.gasCylinder.id } });
                if (currentCylinder) {
                    yield this.gasCylinderRepository.update(item.gasCylinder.id, {
                        stockQuantity: currentCylinder.stockQuantity + item.quantity
                    });
                }
                else {
                    console.warn(`Gas cylinder with ID ${item.gasCylinder.id} not found when trying to restore stock.`);
                }
            }
        });
    }
    // Delete order
    deleteOrder(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { orderId } = req.params;
                const order = yield this.orderRepository.findOne({
                    where: { id: orderId },
                    relations: ['items'], // Include items to ensure they are handled if needed, though direct deletion is separate
                });
                if (!order) {
                    return res.status(404).json({ error: 'Order not found.' });
                }
                if (order.status !== Order_1.OrderStatus.CANCELLED) {
                    return res.status(400).json({
                        error: 'Only cancelled orders can be deleted.',
                        currentStatus: order.status,
                    });
                }
                // Use a transaction to ensure atomicity
                yield database_1.AppDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                    // Delete all associated OrderItem entities
                    // It's important to delete related OrderItems first to avoid foreign key constraints
                    yield transactionalEntityManager.delete(OrderItem_1.OrderItem, { order: { id: orderId } });
                    // Delete the Order entity itself
                    yield transactionalEntityManager.delete(Order_1.Order, orderId);
                }));
                return res.status(200).json({ message: 'Order deleted successfully.' });
            }
            catch (error) {
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
        });
    }
}
exports.OrderController = OrderController;
