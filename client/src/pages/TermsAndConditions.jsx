import React from "react";

const TermsAndConditions = () => {
  return (
    <div
      className="container py-5"
      style={{ maxWidth: "900px", lineHeight: "1.7" }}
    >
      <h1 className="terms-title">Terms &amp; Conditions</h1>

      <p className="terms-text">
        These Terms and Conditions ("Terms") govern your access to and use of
        the public website operated by <strong>Agelka Agencies</strong> ("we",
        "our", "us"). By accessing or using this website, you agree to be bound
        by these Terms.
      </p>

      <p className="terms-text">
        Internal system access is restricted to authorized personnel only and is
        governed by internal company policies and agreements.
      </p>

      {/* ---------------------- Section 1 ---------------------- */}
      <h3 className="terms-section-title">1. Website Purpose</h3>
      <p className="terms-text">
        The public-facing website of Agelka Agencies is provided for
        informational purposes only. It may include:
      </p>
      <ul className="terms-list">
        <li>Information about our company, operations, and services</li>
        <li>Details of clients, suppliers, and partners we work with</li>
        <li>Contact channels for inquiries and communication</li>
      </ul>
      <p className="terms-text">
        The website does not constitute a public software-as-a-service platform
        and does not offer self-service account registration to external users.
      </p>

      {/* ---------------------- Section 2 ---------------------- */}
      <h3 className="terms-section-title">2. Acceptance of Terms</h3>
      <p className="terms-text">
        By accessing the website, you acknowledge that you have read,
        understood, and agree to be bound by these Terms and any policies
        referenced herein, including our Privacy Policy.
      </p>

      {/* ---------------------- Section 3 ---------------------- */}
      <h3 className="terms-section-title">3. Intellectual Property</h3>
      <p className="terms-text">
        Unless otherwise stated, all content on this website, including text,
        graphics, logos, icons, images, and software, is the property of Agelka
        Agencies or its licensors and is protected by applicable intellectual
        property laws.
      </p>
      <p className="terms-text">You may not:</p>
      <ul className="terms-list">
        <li>Reproduce, distribute, or publicly display content without consent</li>
        <li>Use content for commercial purposes without authorization</li>
        <li>Remove proprietary notices or branding</li>
      </ul>

      {/* ---------------------- Section 4 ---------------------- */}
      <h3 className="terms-section-title">4. Prohibited Use</h3>
      <p className="terms-text">You agree not to use the website to:</p>
      <ul className="terms-list">
        <li>Access protected systems or restricted areas</li>
        <li>Interfere with infrastructure or security</li>
        <li>Scrape data using bots or automated tools</li>
        <li>Misrepresent identity in communications</li>
        <li>Transmit harmful or unlawful content</li>
      </ul>
      <p className="terms-text">
        Unauthorized access to internal systems is strictly prohibited and may
        result in legal action.
      </p>

      {/* ---------------------- Section 5 ---------------------- */}
      <h3 className="terms-section-title">5. Disclaimers</h3>
      <p className="terms-text">
        The website is provided on an "as is" and "as available" basis. While we
        strive to provide accurate information, we do not guarantee:
      </p>
      <ul className="terms-list">
        <li>Accuracy or completeness of website content</li>
        <li>Uninterrupted or error-free site performance</li>
        <li>Protection against viruses or harmful components</li>
      </ul>

      {/* ---------------------- Section 6 ---------------------- */}
      <h3 className="terms-section-title">6. Limitation of Liability</h3>
      <p className="terms-text">
        To the fullest extent permitted by law, Agelka Agencies shall not be
        liable for losses arising from:
      </p>
      <ul className="terms-list">
        <li>Use or inability to use the website</li>
        <li>Errors or omissions in published content</li>
        <li>Unauthorized access or alteration of data</li>
      </ul>
      <p className="terms-text">
        Internal operational use is governed by internal policies and not these
        public Terms.
      </p>

      {/* ---------------------- Section 7 ---------------------- */}
      <h3 className="terms-section-title">7. Third-Party Links</h3>
      <p className="terms-text">
        We may reference third-party sites for convenience. We are not
        responsible for external content, security, or policies. Users access
        third-party sites at their own risk.
      </p>

      {/* ---------------------- Section 8 ---------------------- */}
      <h3 className="terms-section-title">8. Access Restriction & Termination</h3>
      <p className="terms-text">
        We may restrict or revoke access to the website at our discretion if we
        believe a user has violated these Terms or poses security risks.
      </p>
      <p className="terms-text">
        Internal accounts may be suspended based on employment or operational
        requirements.
      </p>

      {/* ---------------------- Section 9 ---------------------- */}
      <h3 className="terms-section-title">9. Governing Law</h3>
      <p className="terms-text">
        These Terms are governed by the laws of Sri Lanka. Disputes may be heard
        in the competent courts of Sri Lanka.
      </p>

      {/* ---------------------- Section 10 ---------------------- */}
      <h3 className="terms-section-title">10. Changes to These Terms</h3>
      <p className="terms-text">
        Updates may occur at any time. Continued use constitutes acceptance of
        updated Terms.
      </p>

      {/* ---------------------- Section 11 ---------------------- */}
      <h3 className="terms-section-title">11. Contact Information</h3>
      <p className="terms-text">
        <strong>Agelka Agencies</strong>
        <br />
        41 Rathwaththa Mawatha, Badulla 90000, Sri Lanka
        <br />
        +94 55 720 0446
      </p>
    </div>
  );
};

export default TermsAndConditions;
