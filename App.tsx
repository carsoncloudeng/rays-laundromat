
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { User, UserRole } from './types';
import Login from './views/Login';
import Signup from './views/Signup';
import CustomerDashboard from './views/CustomerDashboard';
import StaffDashboard from './views/StaffDashboard';
import AdminDashboard from './views/AdminDashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('logged_in_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('logged_in_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('logged_in_user');
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          } />
          <Route path="/signup" element={
            user ? <Navigate to="/dashboard" /> : <Signup onSignup={handleLogin} />
          } />
          <Route path="/dashboard" element={
            !user ? <Navigate to="/login" /> : (
              user.role === UserRole.ADMIN ? <AdminDashboard user={user} onLogout={handleLogout} /> :
              user.role === UserRole.STAFF ? <StaffDashboard user={user} onLogout={handleLogout} /> :
              <CustomerDashboard user={user} onLogout={handleLogout} />
            )
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;
