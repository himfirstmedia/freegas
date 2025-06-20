// src/controllers/UserController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

export class UserController {
  private userRepository = AppDataSource.getRepository(User);

  // Get all users
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.userRepository.find({
        select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'isActive', 'createdAt']
      });
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // Get user by ID
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userRepository.findOne({
        where: { id },
        select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'latitude', 'longitude', 'isActive', 'createdAt']
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }

  // Create new user
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, role, address, latitude, longitude } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName || !phone) {
        res.status(400).json({ error: 'Missing required fields' });
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
        role: role || UserRole.CUSTOMER,
        address,
        latitude,
        longitude
      });

      const savedUser = await this.userRepository.save(user);

      // Remove password from response
      const { password: _, ...userResponse } = savedUser;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // Update user
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { email, firstName, lastName, phone, role, address, latitude, longitude, isActive } = req.body;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check if email is being changed and if it already exists
      if (email && email !== user.email) {
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
          res.status(400).json({ error: 'Email already exists' });
          return;
        }
      }

      // Update user fields
      if (email) user.email = email;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phone) user.phone = phone;
      if (role) user.role = role;
      if (address !== undefined) user.address = address;
      if (latitude !== undefined) user.latitude = latitude;
      if (longitude !== undefined) user.longitude = longitude;
      if (isActive !== undefined) user.isActive = isActive;

      const updatedUser = await this.userRepository.save(user);

      // Remove password from response
      const { password: _, ...userResponse } = updatedUser;
      res.json(userResponse);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // Update user password
  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
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
      user.password = hashedNewPassword;

      await this.userRepository.save(user);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  }

  // Delete user (soft delete by setting isActive to false)
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.isActive = false;
      await this.userRepository.save(user);

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  // Get users by role
  async getUsersByRole(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.params;

      if (!Object.values(UserRole).includes(role as UserRole)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      const users = await this.userRepository.find({
        where: { role: role as UserRole, isActive: true },
        select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'isActive', 'createdAt']
      });

      res.json(users);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({ error: 'Failed to fetch users by role' });
    }
  }
}