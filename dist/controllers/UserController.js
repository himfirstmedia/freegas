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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
class UserController {
    constructor() {
        this.userRepository = database_1.AppDataSource.getRepository(User_1.User);
    }
    // Get all users
    getAllUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield this.userRepository.find({
                    select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'isActive', 'createdAt']
                });
                res.json(users);
            }
            catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).json({ error: 'Failed to fetch users' });
            }
        });
    }
    // Get user by ID
    getUserById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const user = yield this.userRepository.findOne({
                    where: { id },
                    select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'latitude', 'longitude', 'isActive', 'createdAt']
                });
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                res.json(user);
            }
            catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).json({ error: 'Failed to fetch user' });
            }
        });
    }
    // Create new user
    createUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, firstName, lastName, phone, role, address, latitude, longitude } = req.body;
                // Validate required fields
                if (!email || !password || !firstName || !lastName || !phone) {
                    res.status(400).json({ error: 'Missing required fields' });
                    return;
                }
                // Check if user already exists
                const existingUser = yield this.userRepository.findOne({ where: { email } });
                if (existingUser) {
                    res.status(400).json({ error: 'Email already exists' });
                    return;
                }
                // Hash password
                const hashedPassword = yield bcrypt_1.default.hash(password, 10);
                // Create user
                const user = this.userRepository.create({
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    phone,
                    role: role || User_1.UserRole.CUSTOMER,
                    address,
                    latitude,
                    longitude
                });
                const savedUser = yield this.userRepository.save(user);
                // Remove password from response
                const { password: _ } = savedUser, userResponse = __rest(savedUser, ["password"]);
                res.status(201).json(userResponse);
            }
            catch (error) {
                console.error('Error creating user:', error);
                res.status(500).json({ error: 'Failed to create user' });
            }
        });
    }
    // Update user
    updateUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { email, firstName, lastName, phone, role, address, latitude, longitude, isActive } = req.body;
                const user = yield this.userRepository.findOne({ where: { id } });
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                // Check if email is being changed and if it already exists
                if (email && email !== user.email) {
                    const existingUser = yield this.userRepository.findOne({ where: { email } });
                    if (existingUser) {
                        res.status(400).json({ error: 'Email already exists' });
                        return;
                    }
                }
                // Update user fields
                if (email)
                    user.email = email;
                if (firstName)
                    user.firstName = firstName;
                if (lastName)
                    user.lastName = lastName;
                if (phone)
                    user.phone = phone;
                if (role)
                    user.role = role;
                if (address !== undefined)
                    user.address = address;
                if (latitude !== undefined)
                    user.latitude = latitude;
                if (longitude !== undefined)
                    user.longitude = longitude;
                if (isActive !== undefined)
                    user.isActive = isActive;
                const updatedUser = yield this.userRepository.save(user);
                // Remove password from response
                const { password: _ } = updatedUser, userResponse = __rest(updatedUser, ["password"]);
                res.json(userResponse);
            }
            catch (error) {
                console.error('Error updating user:', error);
                res.status(500).json({ error: 'Failed to update user' });
            }
        });
    }
    // Update user password
    updatePassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { currentPassword, newPassword } = req.body;
                if (!currentPassword || !newPassword) {
                    res.status(400).json({ error: 'Current password and new password are required' });
                    return;
                }
                const user = yield this.userRepository.findOne({ where: { id } });
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                // Verify current password
                const isValidPassword = yield bcrypt_1.default.compare(currentPassword, user.password);
                if (!isValidPassword) {
                    res.status(400).json({ error: 'Current password is incorrect' });
                    return;
                }
                // Hash new password
                const hashedNewPassword = yield bcrypt_1.default.hash(newPassword, 10);
                user.password = hashedNewPassword;
                yield this.userRepository.save(user);
                res.json({ message: 'Password updated successfully' });
            }
            catch (error) {
                console.error('Error updating password:', error);
                res.status(500).json({ error: 'Failed to update password' });
            }
        });
    }
    // Delete user (soft delete by setting isActive to false)
    deleteUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const user = yield this.userRepository.findOne({ where: { id } });
                if (!user) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }
                user.isActive = false;
                yield this.userRepository.save(user);
                res.json({ message: 'User deactivated successfully' });
            }
            catch (error) {
                console.error('Error deleting user:', error);
                res.status(500).json({ error: 'Failed to delete user' });
            }
        });
    }
    // Get users by role
    getUsersByRole(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { role } = req.params;
                if (!Object.values(User_1.UserRole).includes(role)) {
                    res.status(400).json({ error: 'Invalid role' });
                    return;
                }
                const users = yield this.userRepository.find({
                    where: { role: role, isActive: true },
                    select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'isActive', 'createdAt']
                });
                res.json(users);
            }
            catch (error) {
                console.error('Error fetching users by role:', error);
                res.status(500).json({ error: 'Failed to fetch users by role' });
            }
        });
    }
}
exports.UserController = UserController;
