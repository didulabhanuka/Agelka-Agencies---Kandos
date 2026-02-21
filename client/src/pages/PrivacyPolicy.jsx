import React from "react";

const PrivacyPolicy = () => {
  return (
    <div
      className="container py-5"
      style={{ maxWidth: "900px", lineHeight: "1.7" }}
    >
      <h1 className="policy-title">Privacy Policy</h1>

      <p className="policy-text">
        This Privacy Policy describes how <strong>Agelka Agencies</strong>{" "}
        ("we", "our", "us") collects, uses, and protects information obtained
        through our public website and internal systems.
      </p>

      <p className="policy-text">This Policy applies to:</p>
      <ul className="policy-list">
        <li>Visitors to our public-facing website;</li>
        <li>Individuals who submit inquiries via our contact forms; and</li>
        <li>
          Authorized internal users including employees, branch users, and administrative staff.
        </li>
      </ul>

      <p className="policy-text">
        By accessing our website or submitting information, you acknowledge that
        you have read and understood this Privacy Policy.
      </p>

      {/* ---------------------- Section 1 ---------------------- */}
      <h3 className="policy-section-title">1. Information We Collect</h3>

      <h5 className="policy-sub-title">1.1 Website Visitors</h5>
      <p className="policy-text">We may collect the following information:</p>
      <ul className="policy-list">
        <li>Name, email, phone number, company, and submitted messages</li>
        <li>IP address, browser type, device information, timestamps</li>
        <li>Basic analytics and cookie-based usage tracking</li>
      </ul>

      <h5 className="policy-sub-title">1.2 Internal Authorized Users</h5>
      <p className="policy-text">
        For internal authorized users (employees, branch staff, and administrators), we may collect:
      </p>
      <ul className="policy-list">
        <li>Name, role, branch, and department</li>
        <li>Login credentials (securely hashed passwords)</li>
        <li>Activity logs and operational actions</li>
        <li>Inventory and order workflow records</li>
      </ul>

      <p className="policy-text">We do not store plain-text passwords.</p>

      {/* ---------------------- Section 2 ---------------------- */}
      <h3 className="policy-section-title">2. How We Use Information</h3>
      <p className="policy-text">We may use collected information to:</p>
      <ul className="policy-list">
        <li>Operate internal warehousing and inventory processes</li>
        <li>Respond to inquiries from the website</li>
        <li>Maintain authentication, security, and audit trails</li>
        <li>Improve system reliability and performance</li>
      </ul>

      <p className="policy-text">
        We do not sell or use data for commercial advertising.
      </p>

      {/* ---------------------- Section 3 ---------------------- */}
      <h3 className="policy-section-title">3. Legal Basis for Processing</h3>
      <ul className="policy-list">
        <li>Legitimate business interests</li>
        <li>Internal operational purposes</li>
        <li>Compliance with Sri Lankan law</li>
        <li>Voluntary consent via submissions</li>
      </ul>

      {/* ---------------------- Section 4 ---------------------- */}
      <h3 className="policy-section-title">4. Data Storage and Retention</h3>
      <p className="policy-text">
        Data is retained only as long as necessary for operations, compliance, record-keeping, or dispute resolution.
      </p>

      {/* ---------------------- Section 5 ---------------------- */}
      <h3 className="policy-section-title">5. Data Security</h3>
      <ul className="policy-list">
        <li>HTTPS & encrypted communication</li>
        <li>Role-based access permissions</li>
        <li>Activity logs & monitoring</li>
        <li>Secure password hashing</li>
      </ul>

      <p className="policy-text">No system can guarantee absolute security.</p>

      {/* ---------------------- Section 6 ---------------------- */}
      <h3 className="policy-section-title">6. Disclosure to Third Parties</h3>
      <ul className="policy-list">
        <li>Service providers (hosting, analytics)</li>
        <li>Legal authorities when required</li>
        <li>Internal departments for operations</li>
      </ul>

      {/* ---------------------- Section 7 ---------------------- */}
      <h3 className="policy-section-title">7. Cookies and Analytics</h3>
      <p className="policy-text">
        Cookies help track usage and performance. Disabling them may limit system functionality.
      </p>

      {/* ---------------------- Section 8 ---------------------- */}
      <h3 className="policy-section-title">8. International Transfers</h3>
      <p className="policy-text">
        Data is primarily processed in Sri Lanka. If offshore storage is used, reasonable safeguards will apply.
      </p>

      {/* ---------------------- Section 9 ---------------------- */}
      <h3 className="policy-section-title">9. Your Rights</h3>
      <p className="policy-text">
        Users may request access, corrections, or deletion where legally permitted.
      </p>

      {/* ---------------------- Section 10 ---------------------- */}
      <h3 className="policy-section-title">10. Changes to This Policy</h3>
      <p className="policy-text">
        Updates may occur without prior notice. Continued use signifies acceptance.
      </p>

      {/* ---------------------- Section 11 ---------------------- */}
      <h3 className="policy-section-title">11. Contact Us</h3>

      <p className="policy-text">
        <strong>Agelka Agencies</strong> <br />
        41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka <br />
        +94 55 720 0446
      </p>
    </div>
  );
};

export default PrivacyPolicy;
