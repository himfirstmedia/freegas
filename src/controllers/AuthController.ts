// src/controllers/AuthController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

// In-memory token blacklist (for production, use Redis or database)
const tokenBlacklist = new Set<string>();

export class AuthController {
  private userRepository = AppDataSource.getRepository(User);

  // User login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findOne({ 
        where: { email, isActive: true } 
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Remove password from user object
      const { password: _, ...userResponse } = user;

      res.json({
        message: 'Login successful',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // User registration
  async register(req: Request, res: Response): Promise<void> {
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
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        res.status(400).json({ error: 'Email already exists' });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

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

      const savedUser = await this.userRepository.save(user);

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: savedUser.id, 
          email: savedUser.email, 
          role: savedUser.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userResponse } = savedUser;

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  // Verify token (for protected routes)
  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        res.status(401).json({ error: 'Token has been invalidated' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      const user = await this.userRepository.findOne({
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
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  // User logout (POST method)
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
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
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  // Alternative logout method using DELETE
  async logoutDelete(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
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
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  // Refresh token
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        res.status(401).json({ error: 'Token has been invalidated' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, isActive: true }
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Generate new token
      const newToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Blacklist old token
      tokenBlacklist.add(token);

      // Remove password from user object
      const { password: _, ...userResponse } = user;

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
        user: userResponse
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  // Change password
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');

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

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, isActive: true }
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepository.update(user.id, { password: hashedNewPassword });

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Password change failed' });
    }
  }

  // Forgot password
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = await this.userRepository.findOne({
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
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'password-reset' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      // TODO: Send email with reset token
      // For now, we'll just log it (in production, integrate with email service)
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Forgot password request failed' });
    }
  }

  // Reset password
  async resetPassword(req: Request, res: Response): Promise<void> {
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

      if (decoded.type !== 'password-reset') {
        res.status(400).json({ error: 'Invalid reset token' });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, isActive: true }
      });

      if (!user) {
        res.status(400).json({ error: 'Invalid reset token' });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await this.userRepository.update(user.id, { password: hashedPassword });

      res.json({
        message: 'Password reset successful'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(400).json({ error: 'Invalid or expired reset token' });
      } else {
        res.status(500).json({ error: 'Password reset failed' });
      }
    }
  }
}