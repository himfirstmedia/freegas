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
exports.AuthController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
// In-memory token blacklist (for production, use Redis or database)
const tokenBlacklist = new Set();
class AuthController {
    constructor() {
        this.userRepository = database_1.AppDataSource.getRepository(User_1.User);
    }
    // User login
    login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password } = req.body;
                // Validate required fields
                if (!email || !password) {
                    res.status(400).json({ error: 'Email and password are required' });
                    return;
                }
                // Find user by email
                const user = yield this.userRepository.findOne({
                    where: { email, isActive: true }
                });
                if (!user) {
                    res.status(401).json({ error: 'Invalid credentials' });
                    return;
                }
                // Verify password
                const isValidPassword = yield bcrypt_1.default.compare(password, user.password);
                if (!isValidPassword) {
                    res.status(401).json({ error: 'Invalid credentials' });
                    return;
                }
                // Generate JWT token
                const token = jsonwebtoken_1.default.sign({
                    userId: user.id,
                    email: user.email,
                    role: user.role
                }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
                // Remove password from user object
                const { password: _ } = user, userResponse = __rest(user, ["password"]);
                res.json({
                    message: 'Login successful',
                    token,
                    user: userResponse
                });
            }
            catch (error) {
                console.error('Login error:', error);
                res.status(500).json({ error: 'Login failed' });
            }
        });
    }
    // User registration
    register(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, firstName, lastName, phone, role, address, latitude, longitude } = req.body;
                // Validate required fields
                if (!email || !password || !firstName || !lastName || !phone) {
                    res.status(400).json({ error: 'Missing required fields' });
                    return;
                }
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    res.status(400).json({ error: 'Invalid email format' });
                    return;
                }
                // Validate password strength
                if (password.length < 6) {
                    res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
                    role: role || 'customer', // Default to customer
                    address,
                    latitude,
                    longitude
                });
                const savedUser = yield this.userRepository.save(user);
                // Generate JWT token
                const token = jsonwebtoken_1.default.sign({
                    userId: savedUser.id,
                    email: savedUser.email,
                    role: savedUser.role
                }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
                // Remove password from response
                const { password: _ } = savedUser, userResponse = __rest(savedUser, ["password"]);
                res.status(201).json({
                    message: 'Registration successful',
                    token,
                    user: userResponse
                });
            }
            catch (error) {
                console.error('Registration error:', error);
                res.status(500).json({ error: 'Registration failed' });
            }
        });
    }
    // Verify token (for protected routes)
    verifyToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!token) {
                    res.status(401).json({ error: 'No token provided' });
                    return;
                }
                // Check if token is blacklisted
                if (tokenBlacklist.has(token)) {
                    res.status(401).json({ error: 'Token has been invalidated' });
                    return;
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = yield this.userRepository.findOne({
                    where: { id: decoded.userId, isActive: true },
                    select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'latitude', 'longitude', 'isActive', 'createdAt']
                });
                if (!user) {
                    res.status(401).json({ error: 'Invalid token' });
                    return;
                }
                res.json({
                    message: 'Token is valid',
                    user
                });
            }
            catch (error) {
                console.error('Token verification error:', error);
                res.status(401).json({ error: 'Invalid token' });
            }
        });
    }
    // User logout (POST method)
    logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!token) {
                    res.status(401).json({ error: 'No token provided' });
                    return;
                }
                // Add token to blacklist
                tokenBlacklist.add(token);
                res.json({
                    message: 'Logout successful',
                    success: true
                });
            }
            catch (error) {
                console.error('Logout error:', error);
                res.status(500).json({ error: 'Logout failed' });
            }
        });
    }
    // Alternative logout method using DELETE
    logoutDelete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!token) {
                    res.status(401).json({ error: 'No token provided' });
                    return;
                }
                // Add token to blacklist
                tokenBlacklist.add(token);
                res.json({
                    message: 'Logout successful',
                    success: true
                });
            }
            catch (error) {
                console.error('Logout error:', error);
                res.status(500).json({ error: 'Logout failed' });
            }
        });
    }
    // Refresh token
    refreshToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!token) {
                    res.status(401).json({ error: 'No token provided' });
                    return;
                }
                // Check if token is blacklisted
                if (tokenBlacklist.has(token)) {
                    res.status(401).json({ error: 'Token has been invalidated' });
                    return;
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = yield this.userRepository.findOne({
                    where: { id: decoded.userId, isActive: true }
                });
                if (!user) {
                    res.status(401).json({ error: 'Invalid token' });
                    return;
                }
                // Generate new token
                const newToken = jsonwebtoken_1.default.sign({
                    userId: user.id,
                    email: user.email,
                    role: user.role
                }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
                // Blacklist old token
                tokenBlacklist.add(token);
                // Remove password from user object
                const { password: _ } = user, userResponse = __rest(user, ["password"]);
                res.json({
                    message: 'Token refreshed successfully',
                    token: newToken,
                    user: userResponse
                });
            }
            catch (error) {
                console.error('Token refresh error:', error);
                res.status(401).json({ error: 'Token refresh failed' });
            }
        });
    }
    // Change password
    changePassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { currentPassword, newPassword } = req.body;
                const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!token) {
                    res.status(401).json({ error: 'No token provided' });
                    return;
                }
                if (!currentPassword || !newPassword) {
                    res.status(400).json({ error: 'Current password and new password are required' });
                    return;
                }
                if (newPassword.length < 6) {
                    res.status(400).json({ error: 'New password must be at least 6 characters long' });
                    return;
                }
                // Check if token is blacklisted
                if (tokenBlacklist.has(token)) {
                    res.status(401).json({ error: 'Token has been invalidated' });
                    return;
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = yield this.userRepository.findOne({
                    where: { id: decoded.userId, isActive: true }
                });
                if (!user) {
                    res.status(401).json({ error: 'Invalid token' });
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
                // Update password
                yield this.userRepository.update(user.id, { password: hashedNewPassword });
                res.json({
                    message: 'Password changed successfully'
                });
            }
            catch (error) {
                console.error('Password change error:', error);
                res.status(500).json({ error: 'Password change failed' });
            }
        });
    }
    // Forgot password
    forgotPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = req.body;
                if (!email) {
                    res.status(400).json({ error: 'Email is required' });
                    return;
                }
                const user = yield this.userRepository.findOne({
                    where: { email, isActive: true }
                });
                // Always return success for security reasons (don't reveal if email exists)
                if (!user) {
                    res.json({
                        message: 'If the email exists, a password reset link has been sent'
                    });
                    return;
                }
                // Generate reset token (expires in 1 hour)
                const resetToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, type: 'password-reset' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
                // TODO: Send email with reset token
                // For now, we'll just log it (in production, integrate with email service)
                console.log(`Password reset token for ${email}: ${resetToken}`);
                res.json({
                    message: 'If the email exists, a password reset link has been sent'
                });
            }
            catch (error) {
                console.error('Forgot password error:', error);
                res.status(500).json({ error: 'Forgot password request failed' });
            }
        });
    }
    // Reset password
    resetPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token, newPassword } = req.body;
                if (!token || !newPassword) {
                    res.status(400).json({ error: 'Token and new password are required' });
                    return;
                }
                if (newPassword.length < 6) {
                    res.status(400).json({ error: 'New password must be at least 6 characters long' });
                    return;
                }
                // Verify reset token
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                if (decoded.type !== 'password-reset') {
                    res.status(400).json({ error: 'Invalid reset token' });
                    return;
                }
                const user = yield this.userRepository.findOne({
                    where: { id: decoded.userId, isActive: true }
                });
                if (!user) {
                    res.status(400).json({ error: 'Invalid reset token' });
                    return;
                }
                // Hash new password
                const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
                // Update password
                yield this.userRepository.update(user.id, { password: hashedPassword });
                res.json({
                    message: 'Password reset successful'
                });
            }
            catch (error) {
                console.error('Password reset error:', error);
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    res.status(400).json({ error: 'Invalid or expired reset token' });
                }
                else {
                    res.status(500).json({ error: 'Password reset failed' });
                }
            }
        });
    }
}
exports.AuthController = AuthController;
