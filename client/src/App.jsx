import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';

//  Public Routes
import Home from '@/pages/Home';
import About from '@/pages/About';
import Services from '@/pages/Services';
import Contact from '@/pages/Contact';
import Login from '@/pages/Login';
import Unauthorized from '@/pages/Unauthorized';
import NotFound from '@/pages/NotFound';
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsAndConditions from "@/pages/TermsAndConditions";

//  Protected Routes
import AgelkaDashboard from '@/pages/layout/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const App = () => (
  <AppLayout>
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/services" element={<Services />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Admin Routes */}
      <Route
        path="/agelka-dashboard"
        element={
          <ProtectedRoute allowedRoles={["Admin", "DataEntry", "SalesRep"]}>
            <AgelkaDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback Routes */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppLayout>
);

export default App;
