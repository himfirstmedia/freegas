// src/routes/gasCylinders.ts
import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { GasCylinder } from '../entities/GasCylinder';
import { Supplier } from '../entities/Supplier';

const router = Router();
const gasCylinderRepository = AppDataSource.getRepository(GasCylinder);
const supplierRepository = AppDataSource.getRepository(Supplier);

// GET /api/gas-cylinders - Get all gas cylinders
router.get('/', async (req, res) => {
  try {
    const cylinders = await gasCylinderRepository.find({
      relations: ['supplier'],
      where: { isAvailable: true },
      order: { weight: 'ASC' }
    });
    res.json(cylinders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gas cylinders' });
  }
});

// GET /api/gas-cylinders/:id - Get single gas cylinder
router.get('/:id', async (req, res) => {
  try {
    const cylinder = await gasCylinderRepository.findOne({
      where: { id: req.params.id },
      relations: ['supplier']
    });
    
    if (!cylinder) {
      return res.status(404).json({ error: 'Gas cylinder not found' });
    }
    
    res.json(cylinder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gas cylinder' });
  }
});

// POST /api/gas-cylinders - Create new gas cylinder
router.post('/', async (req, res) => {
  try {
    const { name, weight, price, description, brand, supplierId, stockQuantity, imageUrl } = req.body;
    
    const supplier = await supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }
    
    const cylinder = gasCylinderRepository.create({
      name,
      weight,
      price,
      description,
      brand,
      supplier,
      stockQuantity: stockQuantity || 0,
      imageUrl
    });
    
    const savedCylinder = await gasCylinderRepository.save(cylinder);
    res.status(201).json(savedCylinder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create gas cylinder' });
  }
});

// PUT /api/gas-cylinders/:id - Update gas cylinder
router.put('/:id', async (req, res) => {
  try {
    const { name, weight, price, description, brand, isAvailable, stockQuantity, imageUrl } = req.body;
    
    const cylinder = await gasCylinderRepository.findOne({ where: { id: req.params.id } });
    if (!cylinder) {
      return res.status(404).json({ error: 'Gas cylinder not found' });
    }
    
    await gasCylinderRepository.update(req.params.id, {
      name,
      weight,
      price,
      description,
      brand,
      isAvailable,
      stockQuantity,
      imageUrl
    });
    
    const updatedCylinder = await gasCylinderRepository.findOne({
      where: { id: req.params.id },
      relations: ['supplier']
    });
    
    res.json(updatedCylinder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update gas cylinder' });
  }
});

// DELETE /api/gas-cylinders/:id - Delete gas cylinder
router.delete('/:id', async (req, res) => {
  try {
    const cylinder = await gasCylinderRepository.findOne({ where: { id: req.params.id } });
    if (!cylinder) {
      return res.status(404).json({ error: 'Gas cylinder not found' });
    }
    
    await gasCylinderRepository.remove(cylinder);
    res.json({ message: 'Gas cylinder deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete gas cylinder' });
  }
});

export default router;