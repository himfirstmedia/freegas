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
// src/routes/suppliers.ts
const express_1 = require("express");
const database_1 = require("../config/database");
const Supplier_1 = require("../entities/Supplier");
const router = (0, express_1.Router)();
const supplierRepository = database_1.AppDataSource.getRepository(Supplier_1.Supplier);
// GET /api/suppliers - Get all suppliers
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suppliers = yield supplierRepository.find({
            where: { isActive: true },
            relations: ['gasCylinders']
        });
        res.json(suppliers);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
}));
// POST /api/suppliers - Create new supplier
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const savedSupplier = yield supplierRepository.save(supplier);
        res.status(201).json(savedSupplier);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create supplier' });
    }
}));
exports.default = router;
