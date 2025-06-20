// src/index.ts
import 'reflect-metadata';
import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports that might use them
dotenv.config();

import express from 'express';
import { Router } from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';

// Import controllers
import { AuthController } from './controllers/AuthController';
import { UserController } from './controllers/UserController';

// Import routes
import userRoutes from './routes/users';
import gasCylinderRoutes from './routes/gasCylinders';
import supplierRoutes from './routes/suppliers';
import orderRoutes from './routes/orders';

const app = express();
const PORT = process.env.PORT || 3000;

// Create auth router
const authRouter = Router();
const authController = new AuthController();




// Middleware
app.use(cors());
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
app.use(express.json());
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
app.use('/api/users', userRoutes);
app.use('/api/gas-cylinders', gasCylinderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/orders', orderRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Gas Cylinder Delivery API is running' });
});

// Initialize database and start server
AppDataSource.initialize()
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