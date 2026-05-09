const express = require('express');
const Equipment = require('../models/Equipment');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Add new equipment (Owner/Manager only)
router.post('/', protect, authorize('owner', 'manager'), async (req, res) => {
  try {
    const equipment = new Equipment(req.body);
    await equipment.save();
    res.json(equipment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all equipment (All roles)
router.get('/', protect, authorize('owner', 'manager', 'staff'), async (req, res) => {
  const equipment = await Equipment.find();
  res.json(equipment);
});

// Update equipment (Owner/Manager only)
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
  const equipment = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(equipment);
});

// Delete equipment (Owner only)
router.delete('/:id', protect, authorize('owner'), async (req, res) => {
  await Equipment.findByIdAndDelete(req.params.id);
  res.json({ message: "Equipment deleted" });
});

module.exports = router;
