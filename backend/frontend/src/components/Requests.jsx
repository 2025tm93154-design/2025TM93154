import React, { useEffect, useState } from 'react';
import api from '../services/api';

function Requests() {
  const [requests, setRequests] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const role = localStorage.getItem('role');

  const loadRequests = async () => {
    const data = await api.get('/requests');
    setRequests(data);
  };

  const loadEquipment = async () => {
    if (role === 'staff') {
      const data = await api.get('/equipment');
      setEquipmentList(data);
      if (data.length > 0 && !selectedEquipment) {
        setSelectedEquipment(data[0]._id);
      }
    }
  };

  useEffect(() => {
    loadRequests();
    loadEquipment();
  }, []);

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipment) {
      return;
    }
    await api.post('/requests', { equipment: selectedEquipment });
    await loadRequests();
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/requests/${id}`, { status });
    setRequests(requests.map((r) => (r._id === id ? { ...r, status } : r)));
  };

  return (
    <div className="requests">
      <h2>Requests</h2>
      {role === 'staff' && (
        <form onSubmit={handleRequestSubmit} style={{ marginBottom: '20px' }}>
          <h3>Create Request</h3>
          <div>
            <label>Equipment:</label><br />
            <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}>
              <option value="">Select equipment</option>
              {equipmentList.map((item) => (
                <option value={item._id} key={item._id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Submit Request</button>
        </form>
      )}
      <ul>
        {requests.map((req) => (
          <li key={req._id}>
            {req.staff?.name || 'Staff'} requested {req.equipment?.name || 'Equipment'} - Status: {req.status}
            {(role === 'owner' || role === 'manager') && (
              <div>
                <button onClick={() => handleStatusChange(req._id, 'approved')}>Approve</button>
                <button onClick={() => handleStatusChange(req._id, 'rejected')}>Reject</button>
              </div>
            )}
            {role === 'staff' && req.status === 'approved' && (
              <button onClick={() => handleStatusChange(req._id, 'returned')}>Mark Returned</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Requests;
