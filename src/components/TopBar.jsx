import { useState, useEffect, useRef } from "react";

export default function TopBar({
  title,
  subtitle,
  searchPlaceholder,
  showSearch,
  showNewRecord,
  searchTerm,
  onSearchChange,
  onNewRecord,
  activeTab,
  onTabChange,
  onOpenSalesCRM,
}) {
  // State to handle opening and closing the dropdown list panel
  const [salesMenuOpen, setSalesMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Closes the menu automatically if you click anywhere else on the screen
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSalesMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleRoleClick(view) {
    setSalesMenuOpen(false); // Closes the dropdown panel smoothly
    onOpenSalesCRM?.(view);  // Executes your page transition
  }

  return (
    <header className="zzc-topbar">
      <div>
        <h1>{title}</h1>
        <p className="zzc-muted zzc-small">{subtitle}</p>
      </div>
      <div className="zzc-topbar-actions">
        {showSearch && (
          <input
            className="zzc-search-input"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {showNewRecord && (
          <button className="zzc-btn zzc-btn-primary" onClick={onNewRecord}>
            New record
          </button>
        )}
        
        {["dashboard", "data", "bulk"].map((tab) => (
          <button
            key={tab}
            className={"zzc-btn zzc-btn-outline" + (activeTab === tab ? " active" : "")}
            onClick={() => onTabChange(tab)}
          >
            {tab === "bulk" ? "Bulk tools" : tab}
          </button>
        ))}

                {/* Sales CRM Dropdown Container Layout */}
        <div className="zzc-sales-menu-wrap" ref={dropdownRef}>
          {/* Swapped <a> for <button> to match sizes, and forced non-bold text */}
          <button
            className={"zzc-btn zzc-btn-outline" + (salesMenuOpen ? " active" : "")}
            style={{ fontWeight: "normal", display: "inline-flex", alignItems: "center" }}
            onClick={(e) => {
              e.preventDefault();
              setSalesMenuOpen((prev) => !prev); // Toggles open/close state on click
            }}
          >
            Sales CRM <span className="zzc-caret" style={{ marginLeft: "6px", fontSize: "10px" }}>▼</span>
          </button>

          {/* Conditional dropdown panel containing your 3 team actions */}
          {salesMenuOpen && (
            <div className="zzc-sales-menu">
              <button onClick={() => handleRoleClick("executive")}>
                Sales executive
              </button>
              <button onClick={() => handleRoleClick("manager")}>
                Sales manager
              </button>
              <button onClick={() => handleRoleClick("regional")}>
                Regional manager
              </button>
            </div>
          )}
        </div>
        
        <a href="#" className="zzc-btn-link">Console</a>
      </div>
    </header>
  );
}
