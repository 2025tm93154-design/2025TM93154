const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'returned'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);
