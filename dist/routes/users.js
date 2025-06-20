"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/users.ts
const express_1 = require("express");
const UserController_1 = require("../controllers/UserController");
const router = (0, express_1.Router)();
const userController = new UserController_1.UserController();
// User routes
router.get('/', userController.getAllUsers.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));
router.post('/', userController.createUser.bind(userController));
router.put('/:id', userController.updateUser.bind(userController));
router.patch('/:id/password', userController.updatePassword.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));
router.get('/role/:role', userController.getUsersByRole.bind(userController));
exports.default = router;
