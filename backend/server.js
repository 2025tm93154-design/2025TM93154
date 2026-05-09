const { webcrypto } = require('crypto');
if (!global.crypto) global.crypto = webcrypto;
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db.js');
const User = require('./models/User');
const Equipment = require('./models/Equipment');

const app = express();
app.use(express.json());
app.use(cors());

const seedDefaultData = async () => {
  const defaultUsers = [
    { name: 'Owner', email: 'owner@example.com', password: 'Password123', role: 'owner' },
    { name: 'Manager', email: 'manager@example.com', password: 'Password123', role: 'manager' },
    { name: 'Staff', email: 'staff@example.com', password: 'Password123', role: 'staff' },
  ];

  for (const userData of defaultUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await User.create(userData);
      console.log(`Created default user: ${userData.email}`);
    }
  }

  const equipmentCount = await Equipment.countDocuments();
  if (equipmentCount === 0) {
    await Equipment.insertMany([
      { name: 'Commercial Oven', category: 'Cooking', condition: 'Good', quantity: 2 },
      { name: 'Refrigerator', category: 'Storage', condition: 'Excellent', quantity: 3 },
      { name: 'Dishwasher', category: 'Cleaning', condition: 'Good', quantity: 1 },
    ]);
    console.log('Inserted default equipment items');
  }
};

const startServer = async () => {
  await connectDB();
  await seedDefaultData();

  // API routes
  app.use('/api/users', require('./Routes/UserRoutes'));
  app.use('/api/equipment', require('./Routes/equipmentRoutes'));
  app.use('/api/requests', require('./Routes/RequestRoutes'));

  const frontendDist = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(frontendDist));

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'API route not found' });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();

