// src/routes/users.ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

const router = Router();
const userRepository = AppDataSource.getRepository(User);

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const users = await userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'address', 'isActive', 'createdAt']
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, address, latitude, longitude } = req.body;
    
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = userRepository.create({
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
    
    const savedUser = await userRepository.save(user);
    
    // Remove password from response
    const { password: _, ...userResponse } = savedUser;
    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

export default router;