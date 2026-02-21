import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Footer = () => {
  const { user, logout } = useAuth();

  return (
    <footer className="text-light py-3 mt-auto">
      <div className="container d-flex justify-content-between align-items-center">
        <div className="small">© {new Date().getFullYear()} AGELKA</div>
        <div className="small">
          <a href="/privacy-policy" className="me-3 text-light hover-link">Privacy Policy</a>
          <a href="/terms-and-conditions" className="text-light hover-link">Terms & Conditions</a>

          {/* Conditionally render the Login or Logout links, styled similarly */}
          {user ? (
            <span 
              className="text-light cursor-pointer ms-3 text-decoration-underline hover-link" 
              onClick={logout}>Logout</span>
          ) : (
            <Link to="/login" className="text-light ms-3 text-decoration-underline">Login</Link>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
