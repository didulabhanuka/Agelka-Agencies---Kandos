import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/**
 * AppLayout - central layout for pages.
 * Renders Navbar at top, content in the middle, Footer at bottom.
 * Use in App.jsx: wrap <Routes> inside <AppLayout>
 */
const AppLayout = ({ children }) => (
  <div className="d-flex flex-column min-vh-100">
    <Navbar />
    <main className="flex-grow-1">
      {children}
    </main>
    <Footer />
  </div>
);

export default AppLayout;