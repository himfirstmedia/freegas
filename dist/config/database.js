"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
// src/config/database.ts
const typeorm_1 = require("typeorm");
const User_1 = require("../entities/User");
const GasCylinder_1 = require("../entities/GasCylinder");
const Supplier_1 = require("../entities/Supplier");
const Order_1 = require("../entities/Order");
const OrderItem_1 = require("../entities/OrderItem");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gas_delivery',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    entities: [User_1.User, GasCylinder_1.GasCylinder, Supplier_1.Supplier, Order_1.Order, OrderItem_1.OrderItem],
    migrations: ['src/migrations/*.ts'],
    subscribers: ['src/subscribers/*.ts'],
});
