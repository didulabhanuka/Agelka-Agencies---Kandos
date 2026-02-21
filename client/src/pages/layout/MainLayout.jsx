import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { createContext } from "react";
import {
  navItems,
  dropdownKeys,
  subTabParentMap,
  subTabComponentMap,
  tabComponentMap,
  KEY_MAP,
} from "@/pages/layout/layoutConfig";

import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext"; // ← Correct path

export const DashboardContext = createContext(null);

const MainLayout = () => {
  const { user } = useAuth();
  const roleName = user?.role;

  // pick whatever exists in your auth payload
  const displayName =
    user?.name || user?.fullName || user?.username || user?.email || "User";

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Get encoded params from URL
  const paramMain = params.get("m") || "dash";
  const paramSub = params.get("s") || "";

  // Decode values
  function decodeKey(encoded) {
    const entry = Object.entries(KEY_MAP).find(([_, v]) => v === encoded);
    return entry ? entry[0] : null;
  }

  const [activeTab, setActiveTab] = useState(decodeKey(paramMain) || "business-dashboard");
  const [activeSubTab, setActiveSubTab] = useState(decodeKey(paramSub) || "");

  // Sync URL when tab/subtab changes
  useEffect(() => {
    const newParams = {};

    if (activeTab) newParams.m = KEY_MAP[activeTab];
    if (activeSubTab) newParams.s = KEY_MAP[activeSubTab];

    setParams(newParams, { replace: false });
  }, [activeTab, activeSubTab]);

  // Sync state on browser back/forward
  useEffect(() => {
    const handlePop = () => {
      const m = decodeKey(params.get("m"));
      const s = decodeKey(params.get("s"));

      if (m) setActiveTab(m);
      if (s) setActiveSubTab(s);
    };

    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [params]);

  // UI state for dropdowns
  const [openDropdowns, setOpenDropdowns] = useState(() => {
    const initial = {};
    dropdownKeys.forEach((key) => {
      initial[key] = false;
    });
    return initial;
  });

  const toggleDropdown = (tabKey) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [tabKey]: !prev[tabKey],
    }));
  };

  // Click handlers
  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    setActiveSubTab("");
    navigate(`/dashboard?m=${KEY_MAP[tabKey]}`);
  };

  const handleSubTabClick = (parentKey, subKey) => {
    setActiveTab(parentKey);
    setActiveSubTab(subKey);
    navigate(`/dashboard?m=${KEY_MAP[parentKey]}&s=${KEY_MAP[subKey]}`);

    setOpenDropdowns((prev) => ({
      ...prev,
      [parentKey]: true,
    }));
  };

  // Filter items by role
  const filteredNavItems = navItems.filter((item) => {
    if (item.rolesAllowed && !item.rolesAllowed.includes(roleName)) return false;
    return true;
  });

  // Resolve active component
  let ActiveComponent = null;

  if (activeSubTab && subTabComponentMap[activeSubTab]) {
    ActiveComponent = subTabComponentMap[activeSubTab];
  } else if (tabComponentMap[activeTab]) {
    ActiveComponent = tabComponentMap[activeTab];
  } else {
    ActiveComponent = () => null;
  }

  // FULL RENDER
  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">

        {/* Sidebar
        <div className="col-2 min-vh-100 p-0">
          <div className="nav flex-column nav-pills p-2" role="tablist">

            {filteredNavItems.map((item) => {
              // ---------------- SIMPLE TAB ----------------
              if (item.type === "tab") {
                return (
                  <a
                    key={item.key}
                    className={`nav-link mb-2 custom-tab text-white d-flex justify-content-between align-items-center ${
                      activeTab === item.key ? "active" : ""
                    }`}
                    onClick={() => handleTabClick(item.key)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className={item.icon}></i>
                      <span>{item.label}</span>
                    </div>
                  </a>
                );
              }

              // ---------------- DROPDOWN TAB ----------------
              if (item.type === "dropdown") {
                const filteredSubtabs = item.subtabs.filter((sub) =>
                  sub.rolesAllowed ? sub.rolesAllowed.includes(roleName) : true
                );

                if (filteredSubtabs.length === 0) return null; // hide if empty

                const isOpen = openDropdowns[item.key];
                const collapseId = `${item.key}Collapse`;

                return (
                  <React.Fragment key={item.key}>
                    <a
                      className={`nav-link mb-2 custom-tab text-white d-flex justify-content-between align-items-center ${
                        activeTab === item.key ? "active" : ""
                      }`}
                      onClick={() => toggleDropdown(item.key)}
                      data-bs-toggle="collapse"
                      href={`#${collapseId}`}
                      role="button"
                      aria-expanded={isOpen}
                      aria-controls={collapseId}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className={item.icon}></i>
                        <span>{item.label}</span>
                      </div>
                      <span className="ms-2">{isOpen ? "▾" : "▸"}</span>
                    </a>

                    <div className={`collapse ${isOpen ? "show" : ""}`} id={collapseId}>
                      <div className="nav flex-column ms-3">
                        {filteredSubtabs.map((sub) => (
                          <a
                            key={sub.key}
                            className={`nav-link mb-2 py-1 text-white ${
                              activeSubTab === sub.key ? "active bg-secondary" : ""
                            }`}
                            onClick={() => handleSubTabClick(item.key, sub.key)}
                          >
                            {sub.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              return null;
            })}

          </div>
        </div> */}


        {/* Sidebar */}
        <div className="col-2 min-vh-100 p-0">
          {/* Make sidebar a full-height flex column */}
          <div className="d-flex flex-column h-100">

            {/* Nav (takes remaining space) */}
            <div className="nav flex-column nav-pills p-2 flex-grow-1" role="tablist">

            {filteredNavItems.map((item) => {
              // ---------------- SIMPLE TAB ----------------
              if (item.type === "tab") {
                return (
                  <a
                    key={item.key}
                    className={`nav-link mb-2 custom-tab text-white d-flex justify-content-between align-items-center ${
                      activeTab === item.key ? "active" : ""
                    }`}
                    onClick={() => handleTabClick(item.key)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className={item.icon}></i>
                      <span>{item.label}</span>
                    </div>
                  </a>
                );
              }

              // ---------------- DROPDOWN TAB ----------------
              if (item.type === "dropdown") {
                const filteredSubtabs = item.subtabs.filter((sub) =>
                  sub.rolesAllowed ? sub.rolesAllowed.includes(roleName) : true
                );

                if (filteredSubtabs.length === 0) return null; // hide if empty

                const isOpen = openDropdowns[item.key];
                const collapseId = `${item.key}Collapse`;

                return (
                  <React.Fragment key={item.key}>
                    <a
                      className={`nav-link mb-2 custom-tab text-white d-flex justify-content-between align-items-center ${
                        activeTab === item.key ? "active" : ""
                      }`}
                      onClick={() => toggleDropdown(item.key)}
                      data-bs-toggle="collapse"
                      href={`#${collapseId}`}
                      role="button"
                      aria-expanded={isOpen}
                      aria-controls={collapseId}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className={item.icon}></i>
                        <span>{item.label}</span>
                      </div>
                      <span className="ms-2">{isOpen ? "▾" : "▸"}</span>
                    </a>

                    <div className={`collapse ${isOpen ? "show" : ""}`} id={collapseId}>
                      <div className="nav flex-column ms-3">
                        {filteredSubtabs.map((sub) => (
                          <a
                            key={sub.key}
                            className={`nav-link mb-2 py-1 text-white ${
                              activeSubTab === sub.key ? "active bg-secondary" : ""
                            }`}
                            onClick={() => handleSubTabClick(item.key, sub.key)}
                          >
                            {sub.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              return null;
            })}

            </div>

            {/* User footer (sticks to bottom) */}
{/* User footer (modern) */}
{user && (
  <div className="p-3 mt-auto">
    <div
      className="d-flex align-items-center justify-content-between gap-3 rounded-4 px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <div className="d-flex align-items-center gap-2 min-w-0">
        {/* Avatar circle */}
        <div
          className="d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: 38,
            height: 38,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            flexShrink: 0,
          }}
        >
          <i className="bi bi-person-fill fs-5 text-white"></i>
        </div>

        {/* Name + role */}
        <div className="min-w-0">
          <div className="fw-semibold text-white text-truncate" title={displayName}>
            {displayName}
          </div>

          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {roleName}
            </span>
          </div>
        </div>
      </div>

      {/* Optional: subtle settings icon */}
      <button
        type="button"
        className="btn btn-sm p-0 border-0 text-white-50"
        style={{ background: "transparent" }}
        title="Account"
      >
        <i className="bi bi-gear fs-6"></i>
      </button>
    </div>
  </div>
)}


          </div>
        </div>


        {/* Main Content */}
        <div className="col-10 p-0 vh-100 overflow-auto">
          <div className="tab-content">
            <ActiveComponent />
          </div>
        </div>

      </div>
    </div>
  );
};

export default MainLayout;
