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
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/gasCylinders.ts
const express_1 = require("express");
const database_1 = require("../config/database");
const GasCylinder_1 = require("../entities/GasCylinder");
const Supplier_1 = require("../entities/Supplier");
const router = (0, express_1.Router)();
const gasCylinderRepository = database_1.AppDataSource.getRepository(GasCylinder_1.GasCylinder);
const supplierRepository = database_1.AppDataSource.getRepository(Supplier_1.Supplier);
// GET /api/gas-cylinders - Get all gas cylinders
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cylinders = yield gasCylinderRepository.find({
            relations: ['supplier'],
            where: { isAvailable: true },
            order: { weight: 'ASC' }
        });
        res.json(cylinders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch gas cylinders' });
    }
}));
// GET /api/gas-cylinders/:id - Get single gas cylinder
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cylinder = yield gasCylinderRepository.findOne({
            where: { id: req.params.id },
            relations: ['supplier']
        });
        if (!cylinder) {
            return res.status(404).json({ error: 'Gas cylinder not found' });
        }
        res.json(cylinder);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch gas cylinder' });
    }
}));
// POST /api/gas-cylinders - Create new gas cylinder
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, weight, price, description, brand, supplierId, stockQuantity, imageUrl } = req.body;
        const supplier = yield supplierRepository.findOne({ where: { id: supplierId } });
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
        const savedCylinder = yield gasCylinderRepository.save(cylinder);
        res.status(201).json(savedCylinder);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create gas cylinder' });
    }
}));
// PUT /api/gas-cylinders/:id - Update gas cylinder
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, weight, price, description, brand, isAvailable, stockQuantity, imageUrl } = req.body;
        const cylinder = yield gasCylinderRepository.findOne({ where: { id: req.params.id } });
        if (!cylinder) {
            return res.status(404).json({ error: 'Gas cylinder not found' });
        }
        yield gasCylinderRepository.update(req.params.id, {
            name,
            weight,
            price,
            description,
            brand,
            isAvailable,
            stockQuantity,
            imageUrl
        });
        const updatedCylinder = yield gasCylinderRepository.findOne({
            where: { id: req.params.id },
            relations: ['supplier']
        });
        res.json(updatedCylinder);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update gas cylinder' });
    }
}));
// DELETE /api/gas-cylinders/:id - Delete gas cylinder
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cylinder = yield gasCylinderRepository.findOne({ where: { id: req.params.id } });
        if (!cylinder) {
            return res.status(404).json({ error: 'Gas cylinder not found' });
        }
        yield gasCylinderRepository.remove(cylinder);
        res.json({ message: 'Gas cylinder deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete gas cylinder' });
    }
}));
exports.default = router;
