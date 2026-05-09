import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <h3>Restaurant Equipment Portal</h3>
      <ul>
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/equipment">Equipment</Link></li>
        <li><Link to="/requests">Requests</Link></li>
        <li><button onClick={logout}>Logout</button></li>
      </ul>
      <span className="role">Role: {role}</span>
    </nav>
  );
}

export default Navbar;
