import React, { useEffect, useState } from 'react';
import api from '../services/api';

function EquipmentList() {
  const [equipment, setEquipment] = useState([]);
  const [form, setForm] = useState({
    name: '',
    category: '',
    condition: '',
    quantity: 1,
  });
  const role = localStorage.getItem('role');
  const isManagerOrOwner = role === 'owner' || role === 'manager';

  const loadEquipment = async () => {
    const data = await api.get('/equipment');
    setEquipment(data);
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'quantity' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/equipment', form);
    setForm({ name: '', category: '', condition: '', quantity: 1 });
    await loadEquipment();
  };

  return (
    <div>
      <h2>Equipment List</h2>
      {isManagerOrOwner && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
          <h3>Add Equipment</h3>
          <div>
            <label>Name:</label><br />
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div>
            <label>Category:</label><br />
            <input name="category" value={form.category} onChange={handleChange} required />
          </div>
          <div>
            <label>Condition:</label><br />
            <input name="condition" value={form.condition} onChange={handleChange} required />
          </div>
          <div>
            <label>Quantity:</label><br />
            <input name="quantity" type="number" value={form.quantity} onChange={handleChange} min="1" required />
          </div>
          <button type="submit">Add Equipment</button>
        </form>
      )}
      <ul>
        {equipment.map((item) => (
          <li key={item._id}>
            {item.name} - {item.category} - {item.condition} - {item.quantity} - {item.available ? 'Available' : 'Not Available'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EquipmentList;
