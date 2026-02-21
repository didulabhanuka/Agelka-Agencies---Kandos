import React from 'react';

const Spinner = ({ size = 3 }) => (
  <div className="d-flex justify-content-center my-3" aria-hidden="true">
    <div className="spinner-border" role="status" style={{ width: `${size}rem`, height: `${size}rem` }}>
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

export default Spinner;