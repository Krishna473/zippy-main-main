import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, MapPin, Clock, LogOut, CheckCircle2, AlertCircle, X, MapPinOff, RefreshCw, Coffee, Sunrise, Sunset } from "lucide-react";
import {
  attendanceLogin,
  attendanceLogout,
  attendanceLunchOut,
  attendanceLunchIn,
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
      } else if (actionType === "logout") {
        await attendanceLogout(payload);
      } else if (actionType === "lunch-out") {
        await attendanceLunchOut(payload);
      } else if (actionType === "lunch-in") {
        await attendanceLunchIn(payload);
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
    const isLunchOut = todayRecord && todayRecord.status === "LUNCH_OUT";
    const isLoggedOut = todayRecord && todayRecord.status === "LOGGED_OUT";

    const hasLogin = !!todayRecord?.login_time;
    const hasLunchOut = !!todayRecord?.lunch_out_time;
    const hasLunchIn = !!todayRecord?.lunch_in_time;
    const hasLogout = !!todayRecord?.logout_time;

    const todayDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'long' });

    // Timeline steps based on the screenshot
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Clock size={20} color="#f97316" />
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "#334155" }}>
              Attendance — {todayDate}
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            
            {/* 1. Morning Punch In */}
            <div style={{ 
              background: "white", 
              border: hasLogin ? "1px solid #bbf7d0" : "1px solid #f1f5f9",
              borderRadius: "12px", 
              padding: "20px", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
            }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "50%", 
                display: "flex", justifyContent: "center", alignItems: "center",
                background: hasLogin ? "#dcfce7" : "#f1f5f9",
                color: hasLogin ? "#16a34a" : "#94a3b8"
              }}>
                <CheckCircle2 size={24} />
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, color: hasLogin ? "#334155" : "#94a3b8" }}>Morning Punch In</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                {hasLogin ? new Date(todayRecord.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "—"}
              </div>
              {!hasLogin && (
                <button 
                  onClick={() => openActionModal("login")}
                  style={{ background: "#f97316", color: "white", border: "none", padding: "8px 20px", borderRadius: "20px", marginTop: "10px", cursor: "pointer", fontWeight: 600, width: "100%" }}
                >
                  Punch In
                </button>
              )}
            </div>

            {/* 2. Lunch Out */}
            <div style={{ 
              background: "white", 
              border: (hasLogin && !hasLunchOut) ? "1px solid #fed7aa" : hasLunchOut ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
              borderRadius: "12px", 
              padding: "20px", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
            }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "50%", 
                display: "flex", justifyContent: "center", alignItems: "center",
                background: hasLunchOut ? "#f1f5f9" : (hasLogin && !hasLunchOut) ? "#ffedd5" : "#f8fafc",
                color: hasLunchOut ? "#94a3b8" : (hasLogin && !hasLunchOut) ? "#f97316" : "#cbd5e1"
              }}>
                <Coffee size={20} />
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, color: (hasLogin && !hasLunchOut) || hasLunchOut ? "#334155" : "#cbd5e1" }}>Lunch Out</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                {hasLunchOut ? new Date(todayRecord.lunch_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "—"}
              </div>
              {(hasLogin && !hasLunchOut) && (
                <button 
                  onClick={() => openActionModal("lunch-out")}
                  style={{ background: "#f97316", color: "white", border: "none", padding: "8px 20px", borderRadius: "20px", marginTop: "10px", cursor: "pointer", fontWeight: 600, width: "100%" }}
                >
                  Punch Out
                </button>
              )}
            </div>

            {/* 3. Lunch In */}
            <div style={{ 
              background: "white", 
              border: (hasLunchOut && !hasLunchIn) ? "1px solid #fed7aa" : hasLunchIn ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
              borderRadius: "12px", 
              padding: "20px", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
            }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "50%", 
                display: "flex", justifyContent: "center", alignItems: "center",
                background: hasLunchIn ? "#f1f5f9" : (hasLunchOut && !hasLunchIn) ? "#ffedd5" : "#f8fafc",
                color: hasLunchIn ? "#94a3b8" : (hasLunchOut && !hasLunchIn) ? "#f97316" : "#cbd5e1"
              }}>
                <Coffee size={20} />
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, color: (hasLunchOut && !hasLunchIn) || hasLunchIn ? "#334155" : "#cbd5e1" }}>Lunch In</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                {hasLunchIn ? new Date(todayRecord.lunch_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "—"}
              </div>
              {(hasLunchOut && !hasLunchIn) && (
                <button 
                  onClick={() => openActionModal("lunch-in")}
                  style={{ background: "#f97316", color: "white", border: "none", padding: "8px 20px", borderRadius: "20px", marginTop: "10px", cursor: "pointer", fontWeight: 600, width: "100%" }}
                >
                  Punch In
                </button>
              )}
            </div>

            {/* 4. Evening Logout */}
            <div style={{ 
              background: "white", 
              border: (hasLogin && !isLoggedOut && (!hasLunchOut || hasLunchIn)) ? "1px solid #fed7aa" : hasLogout ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
              borderRadius: "12px", 
              padding: "20px", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.02)"
            }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "50%", 
                display: "flex", justifyContent: "center", alignItems: "center",
                background: hasLogout ? "#f1f5f9" : (hasLogin && !isLoggedOut && (!hasLunchOut || hasLunchIn)) ? "#ffedd5" : "#f8fafc",
                color: hasLogout ? "#94a3b8" : (hasLogin && !isLoggedOut && (!hasLunchOut || hasLunchIn)) ? "#f97316" : "#cbd5e1"
              }}>
                <Sunset size={20} />
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 500, color: (hasLogin && !isLoggedOut && (!hasLunchOut || hasLunchIn)) || hasLogout ? "#334155" : "#cbd5e1" }}>Evening Logout</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                {hasLogout ? new Date(todayRecord.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "—"}
              </div>
              {(hasLogin && !isLoggedOut && (!hasLunchOut || hasLunchIn)) && (
                <button 
                  onClick={() => openActionModal("logout")}
                  style={{ background: "#f97316", color: "white", border: "none", padding: "8px 20px", borderRadius: "20px", marginTop: "10px", cursor: "pointer", fontWeight: 600, width: "100%" }}
                >
                  Punch Out
                </button>
              )}
            </div>

          </div>
        </div>
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
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Login</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Lunch Out</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Lunch In</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Logout</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Duration</th>
              <th style={{ textAlign: "left", padding: "16px", color: "#64748b", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i === history.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontWeight: 500, color: "#334155" }}>{new Date(r.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style={{ padding: "16px", color: "#475569" }}>
                  {r.login_time ? new Date(r.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{r.login_area || ""}</div>
                </td>
                <td style={{ padding: "16px", color: "#475569" }}>
                  {r.lunch_out_time ? new Date(r.lunch_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}
                </td>
                <td style={{ padding: "16px", color: "#475569" }}>
                  {r.lunch_in_time ? new Date(r.lunch_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}
                </td>
                <td style={{ padding: "16px", color: "#475569" }}>
                  {r.logout_time ? new Date(r.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}
                </td>
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
                {actionType === "login" ? <Camera size={22} color="#0d9488" /> : 
                 actionType === "lunch-out" ? <Coffee size={22} color="#f97316" /> :
                 actionType === "lunch-in" ? <Coffee size={22} color="#0d9488" /> :
                 <LogOut size={22} color="#ef4444" />}
                {actionType === "login" ? "Morning Punch In" :
                 actionType === "lunch-out" ? "Lunch Out" :
                 actionType === "lunch-in" ? "Lunch In" :
                 "Evening Logout"}
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
                  <div style={{ width: "220px", height: "220px", position: "relative", borderRadius: "50%", overflow: "hidden", background: "#f1f5f9", border: "4px solid #e2e8f0", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}>
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
                      background: (actionType === "login" || actionType === "lunch-in") ? "#0d9488" : 
                                  actionType === "lunch-out" ? "#f97316" : "#ef4444",
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
                    {actionLoading ? "Processing..." : `Capture & ${actionType === "login" ? "Punch In" : actionType === "lunch-out" ? "Lunch Out" : actionType === "lunch-in" ? "Lunch In" : "Logout"}`}
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
