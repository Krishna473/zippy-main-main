import { useState } from "react";
import { API_BASE } from "../api";
import "./SalesLogin.css"; 

export default function SalesLogin({ onLoginSuccess, onCancel }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        let msg = "Login failed";
        try {
          const body = await res.json();
          msg = body.detail || msg;
        } catch (err) {}
        throw new Error(msg);
      }
      const data = await res.json();
      onLoginSuccess(data.role, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="zzc-login-container">
      <div className="zzc-login-card">
        <h2>Sales Team Login</h2>
        {error && <div className="zzc-login-error">{error}</div>}
        <form onSubmit={handleLogin} className="zzc-login-form">
          <div className="zzc-field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="zzc-field">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="zzc-login-buttons">
            <button type="button" className="zzc-btn zzc-btn-outline" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="zzc-btn zzc-btn-primary" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
