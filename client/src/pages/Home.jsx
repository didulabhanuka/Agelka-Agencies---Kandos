// import React, { useEffect, useState  } from 'react';
// import { useAuth } from '../context/AuthContext';

// const Home = () => {
//   const { user } = useAuth(); // Get the user from context
//   const [greeting, setGreeting] = useState('');

//   useEffect(() => {
//     console.log('User updated:', user);
//     if (user) {
//       const greeting = getTimeOfDayGreeting();
//       setGreeting(greeting);
//     }
//   }, [user]); // Only change greeting when user is updated

//   // Function to get the time-based greeting
//   const getTimeOfDayGreeting = () => {
//     const hours = new Date().getHours();
//     if (hours < 12) {
//       return 'Good Morning';
//     } else if (hours < 18) {
//       return 'Good Afternoon';
//     } else {
//       return 'Good Evening';
//     }
//   };

//   // Function to format the current date and time
//   const getDateTime = () => {
//     const now = new Date();
//     return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
//   };

//   return (
//     <div className="container py-5">
//       {/* Display introductory content only when user is not logged in */}
//       {!user && (
//         <div className="text-center text-white">
//           <h1 className="display-4 font-weight-bold mb-4">Welcome to Agelka Agencies</h1>
//           <p className="lead text-white">
//             our trusted partner for business growth — delivering excellence for Service Providers, Retailers, Distributors, and Merchants.
//           </p>
//           <p className="text-white">
//             Service Provider • Retailer • Distributor • Merchant
//           </p>
//         </div>
//       )}

//       {/* Display content for logged-in users */}
//       {user && (
//         <div className="text-white">
//           <div className="mb-4">
//             <h2 className="font-weight-bold">Welcome to Agelka Agencies Dashboard</h2>
//             <h4 className="text-white">{greeting}, {user.name}!</h4>
//             <p className="font-italic">{getDateTime()}</p>
//           </div>

//           <div className="two-col d-flex justify-content-between mb-4">
//             {/* Left Column: Instructions Card */}
//             <div className="col-fixed">
//               <div className="card glass-card p-3 mb-4 text-white">
//                 <h5 className="font-weight-bold">Instructions:</h5>
//                 <ul>
//                   <li>Join us for our next team meeting to discuss new projects, deadlines, and strategies.</li>
//                   <li>Review daily reports</li>
//                   <li>Update project status</li>
//                 </ul>
//               </div>
//             </div>

//             {/* Right Column: Event and Staff Reminder */}
//             <div className="col-fixed d-flex flex-column">
//               <div className="card glass-card p-3 mb-4 text-white">
//                 <h5 className="font-weight-bold">Upcoming Event:</h5>
//                 <p className="text-white">Join us for our next team meeting to discuss new projects, deadlines, and strategies.</p>
//                 <p><strong>Date:</strong> 25th October 2025</p>
//                 <p><strong>Time:</strong> 10:00 AM</p>
//               </div>

//               <div className="card glass-card p-3 text-white">
//                 <h5 className="font-weight-bold">Staff Reminder:</h5>
//                 <p>Ensure all client requests are handled promptly and keep the project manager updated.</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Home;
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    if (user) {
      setGreeting(getTimeOfDayGreeting());
    }
  }, [user]);

  // Greeting helper
  const getTimeOfDayGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getDateTime = () => {
    const now = new Date();
    return `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  };

  // 👉 If logged in, instantly redirect to dashboard
  if (user) {
    return <Navigate to="/agelka-dashboard" replace />;
  }

  return (
    <div className="container py-5 text-center text-white">
      <h1 className="display-4 font-weight-bold mb-4">Welcome to Agelka Agencies</h1>

      <p className="lead text-white">
        Your trusted partner for business growth — delivering excellence for
        Service Providers, Retailers, Distributors, and Merchants.
      </p>

      <p className="text-white">
        Service Provider • Retailer • Distributor • Merchant
      </p>
    </div>
  );
};

export default Home;
