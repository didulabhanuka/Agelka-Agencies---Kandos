// import React from 'react';
// import { Link } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext'; // To check if the user is logged in

// const Navbar = () => {
//   const { user } = useAuth(); // Get the user object from useAuth context

//   return (
//     <nav className="navbar navbar-expand-lg navbar-dark "> {/* Added padding */}
//       <div className="container-fluid">
//         <Link className="navbar-brand" to="/">AGELKA</Link>
//         <button
//           className="navbar-toggler"
//           type="button"
//           data-bs-toggle="collapse"
//           data-bs-target="#navbarNav"
//           aria-controls="navbarNav"
//           aria-expanded="false"
//           aria-label="Toggle navigation"
//         >
//           <span className="navbar-toggler-icon" />
//         </button>
//         <div className="collapse navbar-collapse " id="navbarNav">
//           <ul className="navbar-nav ms-auto align-items-center">
//             <li className="nav-item">
//               <Link className="nav-link text-white" to="/about">About</Link>
//             </li>
//             <li className="nav-item">
//               <Link className="nav-link text-white" to="/services">Services</Link>
//             </li>
//             <li className="nav-item">
//               <Link className="nav-link text-white" to="/contact">Contact</Link>
//             </li>

//             {/* Conditionally render Dashboard link if a user is logged in */}
//             {user && (
//               <li className="nav-item"> {/* Added margin start for spacing */}
//                 <Link className="nav-link text-white" to="/agelka-dashboard">Dashboard</Link>
//               </li>
//             )}
//           </ul>
//         </div>
//       </div>
//     </nav>
//   );
// };

// export default Navbar;
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user } = useAuth();

  // Brand text + route dynamically change based on login state
  const brandLabel = user ? "AGELKA ERP" : "AGELKA";
  const brandLink = user ? "/agelka-dashboard" : "/";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark">
      <div className="container-fluid">

        {/* Brand changes text + redirect when logged in */}
        <Link className="navbar-brand" to={brandLink}>
          {brandLabel}
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center">
            {!user && (
              <>
                <li className="nav-item">
                  <Link className="nav-link text-white" to="/about">About</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link text-white" to="/services">Services</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link text-white" to="/contact">Contact</Link>
                </li>
              </>
            )}

            {/* Dashboard link no longer needed because brand already does it */}
          </ul>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
