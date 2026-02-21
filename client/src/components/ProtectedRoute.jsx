import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

const getRoleName = (u) => (typeof u?.role === 'string' ? u.role : u?.role);

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner size={3} />;
  if (!user) return <Navigate to="/login" replace />;

  const roleName = getRoleName(user);

  // If allowedRoles is provided and non-empty → enforce match
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(roleName)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
