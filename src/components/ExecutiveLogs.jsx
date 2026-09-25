import { useState, useEffect, useCallback } from "react";
import { getAttendanceByDate, searchExecutiveAttendance } from "../api.js";

export default function ExecutiveLogs({ role }) {
  const [activeTab, setActiveTab] = useState("calendar"); // calendar, search
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadDate = useCallback(async (dateStr) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAttendanceByDate(dateStr);
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchExecutiveAttendance(searchTerm);
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === "calendar") {
      loadDate(selectedDate);
    } else {
      if (!searchTerm) setRecords([]);
    }
  }, [activeTab, selectedDate, loadDate, searchTerm]);

  function getStatusStyle(status) {
    if (status === "LOGGED_IN") return { background: "#e0f2fe", color: "#0369a1" };
    if (status === "LOGGED_OUT") return { background: "#f1f5f9", color: "#475569" };
    return { background: "#fee2e2", color: "#991b1b" };
  }

  function renderModal() {
    if (!selectedRecord) return null;
    const r = selectedRecord;
    return (
      <div className="zzc-modal-overlay" onClick={() => setSelectedRecord(null)}>
        <div className="zzc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
          <h2>Attendance Details</h2>
          <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <p><strong>Executive:</strong> {r.executive_name}</p>
            <p><strong>Date:</strong> {new Date(r.attendance_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span style={{ padding: "3px 6px", borderRadius: "4px", fontSize: "0.8rem", ...getStatusStyle(r.status) }}>{r.status}</span></p>

            <div style={{ borderTop: "1px solid #eee", paddingTop: "15px", display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <h4>LOGIN</h4>
                <p>Time: {r.login_time ? new Date(r.login_time).toLocaleTimeString() : "--"}</p>
                <p>Area: {r.login_area || "--"}</p>
                {r.login_latitude && (
                  <p style={{ fontSize: "0.85rem", color: "#666" }}>
                    Location: {r.login_latitude.toFixed(4)}, {r.login_longitude.toFixed(4)}
                  </p>
                )}
                {r.login_selfie_url && (
                  <img src={"http://localhost:8000" + r.login_selfie_url} alt="Login" style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "8px", marginTop: "10px" }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4>LOGOUT</h4>
                <p>Time: {r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "--"}</p>
                <p>Area: {r.logout_area || "--"}</p>
                {r.logout_latitude && (
                  <p style={{ fontSize: "0.85rem", color: "#666" }}>
                    Location: {r.logout_latitude.toFixed(4)}, {r.logout_longitude.toFixed(4)}
                  </p>
                )}
                {r.logout_selfie_url && (
                  <img src={"http://localhost:8000" + r.logout_selfie_url} alt="Logout" style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "8px", marginTop: "10px" }} />
                )}
              </div>
            </div>

            {r.total_working_minutes > 0 && (
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", textAlign: "center", marginTop: "10px" }}>
                <strong>Total Working Time:</strong> {Math.floor(r.total_working_minutes/60)}h {r.total_working_minutes%60}m
              </div>
            )}
          </div>
          <div className="zzc-modal-actions" style={{ marginTop: "20px" }}>
            <button className="zzc-btn zzc-btn-primary" onClick={() => setSelectedRecord(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <button 
          onClick={() => setActiveTab("calendar")}
          style={{ 
            background: "transparent", border: "none", cursor: "pointer", 
            fontSize: "1rem", fontWeight: activeTab === "calendar" ? 600 : 400,
            color: activeTab === "calendar" ? "var(--primary)" : "var(--muted-foreground)"
          }}
        >
          Calendar View
        </button>
        <button 
          onClick={() => setActiveTab("search")}
          style={{ 
            background: "transparent", border: "none", cursor: "pointer", 
            fontSize: "1rem", fontWeight: activeTab === "search" ? 600 : 400,
            color: activeTab === "search" ? "var(--primary)" : "var(--muted-foreground)"
          }}
        >
          Search (45 Days)
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: "8px", marginBottom: "15px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {activeTab === "calendar" ? (
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Select Date:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", outline: "none", width: "200px" }}
          />
        </div>
      ) : (
        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <input 
            type="text"
            placeholder="Search by executive name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "6px", outline: "none", width: "300px" }}
          />
          <button className="zzc-btn zzc-btn-primary" onClick={handleSearch}>Search</button>
        </div>
      )}

      {loading ? (
        <p>Loading attendance data...</p>
      ) : records.length === 0 ? (
        <p>No records found.</p>
      ) : (
        <div className="table-panel" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem", cursor: "pointer" }}>
            <thead>
              <tr>
                {activeTab === "search" && <th style={{ textAlign: "left", padding: "10px 8px" }}>Date</th>}
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Executive</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Area (Login)</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Login</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Logout</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Duration</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #eee" }} onClick={() => setSelectedRecord(r)}>
                  {activeTab === "search" && <td style={{ padding: "10px 8px" }}>{new Date(r.attendance_date).toLocaleDateString()}</td>}
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.executive_name}</td>
                  <td style={{ padding: "10px 8px" }}>{r.login_area || "--"}</td>
                  <td style={{ padding: "10px 8px" }}>{r.login_time ? new Date(r.login_time).toLocaleTimeString() : "--"}</td>
                  <td style={{ padding: "10px 8px" }}>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "--"}</td>
                  <td style={{ padding: "10px 8px" }}>{r.total_working_minutes ? `${Math.floor(r.total_working_minutes/60)}h ${r.total_working_minutes%60}m` : "--"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px",
                      ...getStatusStyle(r.status)
                    }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renderModal()}
    </div>
  );
}
