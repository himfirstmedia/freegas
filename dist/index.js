"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
require("reflect-metadata");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables FIRST, before any other imports that might use them
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const express_2 = require("express");
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./config/database");
// Import controllers
const AuthController_1 = require("./controllers/AuthController");
// Import routes
const users_1 = __importDefault(require("./routes/users"));
const gasCylinders_1 = __importDefault(require("./routes/gasCylinders"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const orders_1 = __importDefault(require("./routes/orders"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Create auth router
const authRouter = (0, express_2.Router)();
const authController = new AuthController_1.AuthController();
// Middleware
app.use((0, cors_1.default)());
// TEMPORARY DEBUGGING MIDDLEWARE: Add this BEFORE express.json()
// app.use(express.text({ type: '*/*' })); // This tries to parse ANY body as plain text
// app.use((req, res, next) => {
//   // Check if the body was parsed as text
//   if (typeof req.body === 'string' && req.body.length > 0) {
//     console.log('--- Raw Request Body (as text, before JSON parse) ---');
//     console.log(req.body);
//   } else {
//     console.log('--- Raw Request Body (empty or not text) ---', req.body);
//   }
//   next();
// });
// END TEMPORARY DEBUGGING MIDDLEWARE
app.use(express_1.default.json());
app.use('/api/orders', (req, res, next) => {
    console.log('=== ORDER ROUTE DEBUG ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body || {}));
    next();
});
// Auth routes
authRouter.post('/login', authController.login.bind(authController));
authRouter.post('/logout', authController.logout.bind(authController));
authRouter.post('/register', authController.register.bind(authController));
authRouter.get('/verify', authController.verifyToken.bind(authController));
// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', users_1.default);
app.use('/api/gas-cylinders', gasCylinders_1.default);
app.use('/api/suppliers', suppliers_1.default);
app.use('/api/orders', orders_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Gas Cylinder Delivery API is running' });
});
// Initialize database and start server
database_1.AppDataSource.initialize()
    .then(() => {
    console.log('Database connected successfully');
    console.log('Using database:', process.env.DB_NAME);
    console.log('Database host:', process.env.DB_HOST);
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Available auth routes:');
        console.log('- POST /api/auth/register');
        console.log('- POST /api/auth/login');
        console.log('- GET  /api/auth/verify');
        console.log('- GET  /health');
    });
})
    .catch((error) => {
    console.error('Database connection failed:', error);
});
