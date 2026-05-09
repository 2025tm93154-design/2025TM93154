import React from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  const role = localStorage.getItem('role');

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p>Welcome, {role}!</p>
      <nav>
        <ul>
          <li><Link to="/equipment">View Equipment</Link></li>
          {role === 'staff' && <li><Link to="/requests">My Requests</Link></li>}
          {(role === 'owner' || role === 'manager') && <li><Link to="/requests">Manage Requests</Link></li>}
        </ul>
      </nav>
    </div>
  );
}

export default Dashboard;
