import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EquipmentList from './components/EquipmentList';
import Requests from './components/Requests';
import Navbar from './components/Navbar';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate replace to="/login" />;
};

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      {token && <Navbar />}
      <Routes>
        <Route path="/" element={token ? <Navigate replace to="/dashboard" /> : <Navigate replace to="/login" />} />
        <Route path="/login" element={token ? <Navigate replace to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/equipment" element={<ProtectedRoute><EquipmentList /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
