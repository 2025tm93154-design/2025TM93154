const express = require('express');
const Request = require('../models/Request');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

// Staff can request equipment
router.post('/', protect, authorize('staff'), async (req, res) => {
  try {
    const request = new Request({
      equipment: req.body.equipment,
      staff: req.user._id,
      status: 'pending'
    });
    await request.save();
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Managers/Owners can approve/reject requests
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mark as returned (Staff/Admin)
router.put('/:id/return', protect, authorize('owner', 'manager', 'staff'), async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(req.params.id, { status: 'returned' }, { new: true });
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// View requests
router.get('/', protect, authorize('owner', 'manager', 'staff'), async (req, res) => {
  const query = req.user.role === 'staff' ? { staff: req.user._id } : {};
  const requests = await Request.find(query).populate('equipment staff');
  res.json(requests);
});

module.exports = router;
