import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, MapPin, Clock, LogOut, CheckCircle2, AlertCircle, X, MapPinOff, RefreshCw } from "lucide-react";
import {
  attendanceLogin,
  attendanceLogout,
  getTodayAttendance,
  getExecutiveHistory,
} from "../api.js";

export default function Attendance({ user }) {
  const [activeTab, setActiveTab] = useState("today"); // today, history
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Camera & Action State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'login' or 'logout'
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "today") {
        const data = await getTodayAttendance(user.id);
        setTodayRecord(data);
      } else {
        const data = await getExecutiveHistory(user.id);
        setHistory(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user.id, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function openActionModal(type) {
    setActionType(type);
    setIsActionModalOpen(true);
    setModalError(null);
    setLocationData(null);
    startCameraAndLocation();
  }

  function closeActionModal() {
    setIsActionModalOpen(false);
    stopCamera();
    setLocationData(null);
  }

  async function startCameraAndLocation() {
    setModalError(null);
    setLocationLoading(true);
    
    // 1. Start Camera
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported on this device.");
      }
      const ms = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(ms);
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
      }
    } catch (err) {
      setModalError(`Camera error: ${err.name || err.message}. Please allow permissions.`);
      setLocationLoading(false);
      return;
    }

    // 2. Fetch Location & Area
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0 
        });
      });
      
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      // Reverse Geocoding via OSM Nominatim
      let areaName = "Unknown Area";
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const geoData = await geoRes.json();
        areaName = geoData.address.suburb || geoData.address.neighbourhood || geoData.address.village || geoData.address.town || geoData.address.city || "Unknown Area";
      } catch (e) {
        console.error("Geocoding failed", e);
      }

      setLocationData({ lat, lng, area: areaName });
    } catch (err) {
      setModalError("Unable to retrieve location. Please allow location access.");
    } finally {
      setLocationLoading(false);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }

  async function handleCaptureAndSubmit() {
    if (!videoRef.current || !canvasRef.current || !locationData) return;
    
    setActionLoading(true);
    setModalError(null);
    try {
      // Capture Photo
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const imgData = canvasRef.current.toDataURL("image/jpeg", 0.7);

      const payload = {
        executive_id: user.id,
        latitude: locationData.lat,
        longitude: locationData.lng,
        area: locationData.area,
        selfie_data: imgData
      };

      if (actionType === "login") {
        await attendanceLogin(payload);
      } else {
        await attendanceLogout(payload);
      }
      
      closeActionModal();
      await loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function formatDuration(minutes) {
    if (!minutes) return "--";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  function renderToday() {
    if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)" }}>Loading attendance...</div>;

    const isLoggedIn = todayRecord && todayRecord.status === "LOGGED_IN";
    const isLoggedOut = todayRecord && todayRecord.status === "LOGGED_OUT";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Status Hero Card */}
        <div style={{ 
          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", 
          borderRadius: "16px", 
          padding: "30px", 
          color: "white",
          boxShadow: "0 10px 25px rgba(13, 148, 136, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          <div>
            <h2 style={{ fontSize: "1.8rem", margin: "0 0 8px 0", fontWeight: 700 }}>
              {isLoggedIn ? "You are currently On Shift" : isLoggedOut ? "Shift Completed for Today" : "Ready to start your day?"}
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "1.1rem" }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          {!isLoggedOut && (
            <button 
              onClick={() => openActionModal(isLoggedIn ? "logout" : "login")}
              style={{
                background: isLoggedIn ? "#ef4444" : "white",
                color: isLoggedIn ? "white" : "#0f766e",
                border: "none",
                padding: "14px 28px",
                borderRadius: "50px",
                fontSize: "1.1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                transition: "transform 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {isLoggedIn ? <LogOut size={20} /> : <Camera size={20} />}
              {isLoggedIn ? "End Shift (Logout)" : "Start Shift (Login)"}
            </button>
          )}
        </div>

        {/* Details Cards */}
        {todayRecord && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            
            {/* Login Details */}
            <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "#f8fafc", display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#334155" }}>Login Details</h3>
              </div>
              <div style={{ padding: "20px", display: "flex", gap: "20px" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <Clock size={16} color="#64748b" style={{ marginTop: "3px" }} />
                    <div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Time</div>
                      <div style={{ fontSize: "1.1rem", color: "#0f172a" }}>{new Date(todayRecord.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <MapPin size={16} color="#64748b" style={{ marginTop: "3px" }} />
                    <div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Area</div>
                      <div style={{ fontSize: "1.0rem", color: "#0f172a" }}>{todayRecord.login_area || "—"}</div>
                    </div>
                  </div>
                </div>
                {todayRecord.login_selfie_url && (
                  <img src={"http://localhost:8000" + todayRecord.login_selfie_url} alt="Login Selfie" style={{ width: "90px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                )}
              </div>
            </div>

            {/* Logout Details */}
            {todayRecord.logout_time && (
              <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "#f8fafc", display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <LogOut size={18} color="#ef4444" />
                    <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#334155" }}>Logout Details</h3>
                  </div>
                  <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600 }}>
                    {formatDuration(todayRecord.total_working_minutes)} Total
                  </span>
                </div>
                <div style={{ padding: "20px", display: "flex", gap: "20px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <Clock size={16} color="#64748b" style={{ marginTop: "3px" }} />
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Time</div>
                        <div style={{ fontSize: "1.1rem", color: "#0f172a" }}>{new Date(todayRecord.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <MapPin size={16} color="#64748b" style={{ marginTop: "3px" }} />
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Area</div>
                        <div style={{ fontSize: "1.0rem", color: "#0f172a" }}>{todayRecord.logout_area || "—"}</div>
                      </div>
                    </div>
                  </div>
                  {todayRecord.logout_selfie_url && (
                    <img src={"http://localhost:8000" + todayRecord.logout_selfie_url} alt="Logout Selfie" style={{ width: "90px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderHistory() {
    if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)" }}>Loading history...</div>;
    if (history.length === 0) return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", background: "white", borderRadius: "12px", border: "1px solid var(--border)" }}>No attendance records found.</div>;
    
    return (
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Date</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Area (Login)</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Login</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Logout</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Duration</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i === history.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontWeight: 500, color: "#334155" }}>{new Date(r.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style={{ padding: "16px", color: "#475569" }}>{r.login_area || "—"}</td>
                <td style={{ padding: "16px", color: "#475569" }}>{r.login_time ? new Date(r.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}</td>
                <td style={{ padding: "16px", color: "#475569" }}>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}</td>
                <td style={{ padding: "16px", color: "#475569", fontWeight: 600 }}>{formatDuration(r.total_working_minutes)}</td>
                <td style={{ padding: "16px" }}>
                  <span style={{ 
                    padding: "6px 12px", 
                    borderRadius: "20px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: r.status === "LOGGED_IN" ? "#e0f2fe" : "#f1f5f9",
                    color: r.status === "LOGGED_IN" ? "#0369a1" : "#475569" 
                  }}>
                    {r.status === "LOGGED_IN" ? "Active" : "Completed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "30px", marginBottom: "30px", borderBottom: "2px solid #e2e8f0" }}>
        <button 
          onClick={() => setActiveTab("today")}
          style={{ 
            background: "transparent", border: "none", cursor: "pointer", 
            fontSize: "1.1rem", fontWeight: activeTab === "today" ? 600 : 500,
            color: activeTab === "today" ? "var(--primary)" : "#64748b",
            paddingBottom: "12px",
            borderBottom: activeTab === "today" ? "3px solid var(--primary)" : "3px solid transparent",
            marginBottom: "-2px",
            transition: "all 0.2s"
          }}
        >
          Today's Overview
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          style={{ 
            background: "transparent", border: "none", cursor: "pointer", 
            fontSize: "1.1rem", fontWeight: activeTab === "history" ? 600 : 500,
            color: activeTab === "history" ? "var(--primary)" : "#64748b",
            paddingBottom: "12px",
            borderBottom: activeTab === "history" ? "3px solid var(--primary)" : "3px solid transparent",
            marginBottom: "-2px",
            transition: "all 0.2s"
          }}
        >
          My History
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "16px", borderRadius: "10px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {activeTab === "today" ? renderToday() : renderHistory()}

      {/* Action Modal (Login/Logout Camera) */}
      {isActionModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: "20px"
        }} onClick={closeActionModal}>
          <div style={{
            background: "white", borderRadius: "20px", width: "100%", maxWidth: "450px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "10px" }}>
                {actionType === "login" ? <Camera size={22} color="#0d9488" /> : <LogOut size={22} color="#ef4444" />}
                {actionType === "login" ? "Start Shift" : "End Shift"}
              </h3>
              <button onClick={closeActionModal} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: "24px" }}>
              {modalError ? (
                <div style={{ background: "#fee2e2", color: "#991b1b", padding: "16px", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.95rem" }}>
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>{modalError}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", position: "relative", borderRadius: "16px", overflow: "hidden", background: "#f1f5f9", aspectRatio: "3/4", border: "2px solid #e2e8f0" }}>
                    <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }}></video>
                    <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
                  </div>
                  
                  <div style={{ width: "100%", marginTop: "24px", padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {locationLoading ? (
                        <RefreshCw size={20} color="#0d9488" className="animate-spin" />
                      ) : locationData ? (
                        <MapPin size={20} color="#059669" />
                      ) : (
                        <MapPinOff size={20} color="#ef4444" />
                      )}
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Location Status</div>
                        <div style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 500 }}>
                          {locationLoading ? "Acquiring GPS & Area..." : locationData ? locationData.area : "Location required"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleCaptureAndSubmit}
                    disabled={actionLoading || locationLoading || !locationData || !stream}
                    style={{
                      width: "100%",
                      marginTop: "24px",
                      padding: "16px",
                      background: actionType === "login" ? "#0d9488" : "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      cursor: (actionLoading || locationLoading || !locationData || !stream) ? "not-allowed" : "pointer",
                      opacity: (actionLoading || locationLoading || !locationData || !stream) ? 0.6 : 1,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    {actionLoading ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <Camera size={20} />
                    )}
                    {actionLoading ? "Processing..." : `Capture & ${actionType === "login" ? "Login" : "Logout"}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
