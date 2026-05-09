const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  condition: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  available: { type: Boolean, default: true }
});

module.exports = mongoose.model('Equipment', equipmentSchema);
