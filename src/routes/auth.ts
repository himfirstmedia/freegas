// src/routes/auth.ts
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';

const router = Router();
const authController = new AuthController();

// Authentication routes
router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));
router.get('/verify', authController.verifyToken.bind(authController));

// Logout routes (supporting both POST and DELETE methods)
router.post('/logout', authController.logout.bind(authController));
router.delete('/logout', authController.logoutDelete.bind(authController));

// Token management
router.post('/refresh', authController.refreshToken.bind(authController));

// Password management
router.post('/change-password', authController.changePassword.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));

export default router;