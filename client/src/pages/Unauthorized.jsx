import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // adjust path if different

const Unauthorized = () => {
  const { user } = useAuth();
  const role = user?.role;

  // Dynamic role-based messaging
  const getMessage = () => {
    if (!role) return "You must be logged in to access this page.";

    switch (role) {
      case "admin":
        return "Admin privileges detected, but this page requires higher-level authorization.";
      case "manager":
        return "This page is restricted to administrative accounts only.";
      case "branch":
        return "Branch-level accounts do not have permission to access this resource.";
      case "staff":
        return "Staff accounts are restricted from accessing this section.";
      case "viewer":
        return "View-only accounts cannot perform this action.";
      default:
        return "You do not have permission to access this page.";
    }
  };

  return (
    <div
      className="container d-flex flex-column align-items-center justify-content-center py-5"
      style={{ minHeight: "70vh", textAlign: "center" }}
    >
      <style>
        {`
          .unauth-title {
            font-size: 2.8rem;
            font-weight: 700;
            color: #5c3e94;
          }

          .unauth-sub {
            font-size: 1.15rem;
            margin-top: 10px;
            font-weight: 500;
          }

          .unauth-text {
            max-width: 480px;
            margin: 15px auto;
            font-size: 0.95rem;
            color: #6c757d;
            line-height: 1.6;
          }

          .action-btn {
            border-radius: 8px;
            border: 1px solid #5c3e94;
            color: white;
            padding: 0.55rem 1.25rem;
            background: #5c3e94;
            font-size: 0.9rem;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-block;
          }

          .action-btn:hover {
            background: #452f72;
            border-color: #452f72;
            color: #fff;
          }

          .unauth-links a {
            color: #ffffffff;
            text-decoration: none;
            font-size: 0.85rem;
            margin: 0 6px;
          }

          .unauth-links a:hover {
            text-decoration: underline;
          }
      `}
      </style>

      <h1 className="unauth-title">Unauthorized</h1>

      <h4 className="unauth-sub">Access Restricted</h4>

      <p className="unauth-text">{getMessage()}</p>

      <Link to="/" className="action-btn">Return Home</Link>

      <div className="unauth-links mt-3">
        <Link to="/login">Login</Link> | 
        <Link to="/contact">Contact Support</Link>
      </div>
    </div>
  );
};

export default Unauthorized;
