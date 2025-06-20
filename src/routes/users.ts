// src/routes/users.ts
import { Router } from 'express';
import { UserController } from '../controllers/UserController';

const router = Router();
const userController = new UserController();

// User routes
router.get('/', userController.getAllUsers.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));
router.post('/', userController.createUser.bind(userController));
router.put('/:id', userController.updateUser.bind(userController));
router.patch('/:id/password', userController.updatePassword.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));
router.get('/role/:role', userController.getUsersByRole.bind(userController));

export default router;