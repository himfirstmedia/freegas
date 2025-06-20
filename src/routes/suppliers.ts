// src/routes/suppliers.ts
import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Supplier } from '../entities/Supplier';

const router = Router();
const supplierRepository = AppDataSource.getRepository(Supplier);

// GET /api/suppliers - Get all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await supplierRepository.find({
      where: { isActive: true },
      relations: ['gasCylinders']
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, latitude, longitude } = req.body;
    
    const supplier = supplierRepository.create({
      name,
      contactPerson,
      phone,
      email,
      address,
      latitude,
      longitude
    });
    
    const savedSupplier = await supplierRepository.save(supplier);
    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

export default router;
