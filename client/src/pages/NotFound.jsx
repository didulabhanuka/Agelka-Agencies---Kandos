import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
  <div
    className="container d-flex flex-column align-items-center justify-content-center py-5"
    style={{ minHeight: "70vh", textAlign: "center" }}
  >
    <style>
      {`
        .notfound-title {
          font-size: 4rem;
          font-weight: 700;
          color: #5c3e94;
        }

        .notfound-sub {
          font-size: 1.2rem;
          margin-top: 10px;
          font-weight: 500;
        }

        .notfound-text {
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

        .notfound-links a {
          color: #ffffffff;
          text-decoration: none;
          font-size: 0.85rem;
          margin: 0 6px;
        }

        .notfound-links a:hover {
          text-decoration: underline;
        }
      `}
    </style>

    <h1 className="notfound-title">404</h1>

    <h4 className="notfound-sub">Page Not Found</h4>

    <p className="notfound-text">
      The page you're looking for doesn't exist or may have been moved.
      Please check the URL or return to the home page.
    </p>

    <Link to="/" className="action-btn">Go Home</Link>

    <div className="notfound-links mt-3">
      <Link to="/contact">Contact Support</Link> | 
      <Link to="/services">View Services</Link>
    </div>
  </div>
);

export default NotFound;
