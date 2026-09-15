import { useState, useEffect, useCallback, useMemo } from "react";
import { VscSearch, VscEye } from "react-icons/vsc";
import {
  fetchList,
  TABLE_CONFIG,
  coerceFieldValue,
  displayFieldValue,
  buildRecordPayload,
  updateRecord,
  API_BASE,
} from "../api.js";
import logo from "../assets/zenve-zippy-logo.png";
import "./SalesCRM.css";
import PlanView from "./planView.jsx";
import {
  usePlanStats,
  PLAN_MONTH_KEY,
  PLAN_MONTH_LABEL,
  getCurrentMonthKey,
  formatMonthLabel,
  getAvailableMonthOptions,
} from "./planData.js";
import { fetchSubmissionReports, createSubmissionReport, updateSubmissionReport, deleteSubmissionReport } from "./reportData.js";

/* ─────────────────────────────────────────────────────────
   ROLE → TABLE KEY MAP
───────────────────────────────────────────────────────── */
const ROLE_TABLE_KEY = {
  executive: "sales_executives",
  manager: "sales_managers",
  regional: "regional_managers",
};

/* ─────────────────────────────────────────────────────────
   SMALL SHARED UI COMPONENTS
───────────────────────────────────────────────────────── */
function Stat({ icon, title, value, text, type }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${type}`}>{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function Chart({ title, categories, targets, achieved }) {
  const max = Math.max(1, ...targets, ...achieved);
  return (
    <div className="panel">
      <div className="panel-title">
        <h2>{title}</h2>
        <div className="legend">
          <span><i className="blue-dot" />Target</span>
          <span><i className="green-dot" />Achieved</span>
        </div>
      </div>
      <div className="chart">
        {categories.map((cat, i) => (
          <div className="month" key={cat}>
            <div className="bars">
              <div className="bar target" style={{ height: `${(targets[i] / max) * 145}px` }} />
              <div className="bar achieved" style={{ height: `${(achieved[i] / max) * 145}px` }} />
            </div>
            <small>{cat}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Achievement({ percentage, achieved, progress, pending }) {
  return (
    <div className="panel">
      <div className="panel-title"><h2>Achievement Overview</h2></div>
      <div className="achievement">
        <div className="donut">
          <div>
            <strong>{percentage}</strong>
            <span>Achieved</span>
          </div>
        </div>
        <div className="achievement-list">
          <div><span><i className="green-dot" />Achieved</span><strong>{achieved}</strong></div>
          <div><span><i className="orange-dot" />In Progress</span><strong>{progress}</strong></div>
          <div><span><i className="red-dot" />Pending</span><strong>{pending}</strong></div>
        </div>
      </div>
    </div>
  );
}

function Performers({ title, people }) {
  return (
    <div className="panel">
      <div className="panel-title"><h2>{title}</h2></div>
      {people.length === 0 ? (
        <p style={{ color: "#7f8b98", fontSize: 13 }}>No data yet.</p>
      ) : (
        people.map((person, index) => (
          <div className="performer" key={person[0]}>
            <div className="rank">{index + 1}</div>
            <div className="person-avatar">{person[0].charAt(0)}</div>
            <div className="person">
              <strong>{person[0]}</strong>
              <small>{person[1]}</small>
            </div>
            <div className="performance">
              <div className="progress"><div style={{ width: person[2] }} /></div>
              <strong>{person[2]}</strong>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DashTable({ title, headers, rows }) {
  return (
    <div className="panel table-panel">
      <div className="panel-title"><h2>{title}</h2></div>
      <table>
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ color: "#7f8b98" }}>No data yet</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusList({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel-title"><h2>{title}</h2></div>
      {rows.map((r) => (
        <div className="lead-row" key={r[0]}>
          <strong>{r[0]}</strong>
          <div className="lead-progress"><div style={{ width: r[2] }} /></div>
          <span>{r[1]}</span>
        </div>
      ))}
    </div>
  );
}

function UpcomingList({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel-title"><h2>{title}</h2></div>
      {rows.length === 0 ? (
        <p style={{ color: "#7f8b98", fontSize: 13 }}>Nothing coming up.</p>
      ) : (
        rows.map((r, i) => (
          <div className="followup" key={i}>
            <div className="person-avatar">{r[0].charAt(0)}</div>
            <div className="followup-info">
              <strong>{r[0]}</strong>
              <small>{r[1]}</small>
            </div>
            <span>{r[2]}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DATA HOOK
───────────────────────────────────────────────────────── */
function useSalesData() {
  const [state, setState] = useState({ loading: true, error: null });
  const [executives, setExecutives] = useState([]);
  const [salesManagers, setSalesManagers] = useState([]);
  const [regionalManagers, setRegionalManagers] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [products, setProducts] = useState([]);

  const load = useCallback(() => {
    setState({ loading: true, error: null });
    return Promise.all([
      fetchList("sales_executives"),
      fetchList("sales_managers").catch(() => []),
      fetchList("regional_managers").catch(() => []),
      fetchList("pincode_coverage"),
      fetchList("executive_tasks"),
      fetchList("executive_alerts").catch(() => []),
      fetchList("doctors"),
      fetchList("products"),
    ])
      .then(([execs, mgrs, regs, cov, tsk, alr, docs, prods]) => {
        setExecutives(execs);
        setSalesManagers(mgrs);
        setRegionalManagers(regs);
        setCoverage(cov);
        setTasks(tsk);
        setAlerts(alr);
        setDoctors(docs);
        setProducts(prods);
        setState({ loading: false, error: null });
        return { executives: execs, doctors: docs, coverage: cov };
      })
      .catch((err) => {
        setState({ loading: false, error: err.message || "Failed to load data" });
        return null;
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  return { ...state, executives, salesManagers, regionalManagers, coverage, tasks, alerts, doctors, products, reload: load };
}

/* ─────────────────────────────────────────────────────────
   PROFILE MODAL
───────────────────────────────────────────────────────── */
function ProfileModal({ tableKey, record, onClose, onSaved }) {
  const config = TABLE_CONFIG[tableKey];
  const fields = config.fields;
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = displayFieldValue(f, record); });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(key, value) {
    setValues((p) => ({ ...p, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const changes = {};
      fields.forEach((f) => {
        if (f.readOnly) return;
        changes[f.key] = coerceFieldValue(f, values[f.key]);
      });
      const payload = buildRecordPayload(tableKey, record, changes);
      await updateRecord(tableKey, record.id, payload);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function renderInput(field) {
    const value = values[field.key];
    const id = "pf_" + field.key;
    if (field.readOnly) return <input id={id} value={value ?? ""} disabled />;
    if (field.type === "bool") return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => handleChange(field.key, e.target.checked)} />;
    if (field.type === "yesno") return (
      <select id={id} value={value === true || value === "Yes" ? "Yes" : "No"} onChange={(e) => handleChange(field.key, e.target.value)}>
        <option value="Yes">Yes</option><option value="No">No</option>
      </select>
    );
    if (field.type === "number") return <input id={id} type="number" step="any" value={value ?? ""} required={field.required} onChange={(e) => handleChange(field.key, e.target.value)} />;
    if (field.type === "date") return <input id={id} type="date" value={value ?? ""} required={field.required} onChange={(e) => handleChange(field.key, e.target.value)} />;
    return <input id={id} value={value ?? ""} required={field.required} onChange={(e) => handleChange(field.key, e.target.value)} />;
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal">
        <h2>{record.name || "Profile"}</h2>
        {error && <div className="rpt-call-error">{error}</div>}
        <form id="profileForm" className="zzc-modal-form" onSubmit={handleSave}>
          {fields.map((field) => (
            <div className="zzc-field" key={field.key}>
              <label htmlFor={"pf_" + field.key}>{field.label || field.key}{field.required ? " *" : ""}</label>
              {renderInput(field)}
            </div>
          ))}
        </form>
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="profileForm" className="zzc-btn zzc-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PRE-CALL MODAL
───────────────────────────────────────────────────────── */
function PreCallModal({ visit, onClose, onSave }) {
  const [brands, setBrands] = useState(visit.brands === "—" ? "" : visit.brands);
  const [campaign, setCampaign] = useState(visit.campaign === "—" ? "" : visit.campaign);
  const [objective, setObjective] = useState(visit.preCallObjective || "");
  const [notes, setNotes] = useState(visit.preCallNotes || "");

  function handleSave(e) {
    e.preventDefault();
    onSave({ ...visit, brands: brands || "—", campaign: campaign || "—", preCallObjective: objective, preCallNotes: notes });
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal">
        <div className="rpt-call-modal-header">
          <div>
            <h2>Pre Call — {visit.doctorName}</h2>
            <p className="rpt-call-modal-sub">Sno: {visit.advaitNo} · <span className="rpt-doc-tag">{visit.tag}</span></p>
            <p className="rpt-call-modal-sub">
              Phone: {visit.phone || "—"} · City: {visit.city || "—"} · Pin: {visit.pincode || "—"} · Specialization: {visit.tag || "—"}
            </p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <form id="preCallForm" className="rpt-call-form" onSubmit={handleSave}>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Product</label>
              <input
                value={brands}
                onChange={(e) => setBrands(e.target.value)}
                placeholder="e.g. Nebicard, Losar"
                required
              />
            </div>
            <div className="rpt-call-field">
              <label>Campaign / Sales Activity</label>
              <input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g. HeartBeat 2026"
              />
            </div>
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Call Objective</label>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What do you plan to discuss?"
            />
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Pre-Call Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Doctor background, previous prescriptions, talking points…"
            />
          </div>
        </form>

        <div className="rpt-call-modal-footer">
          <button type="button" className="rpt-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="preCallForm" className="rpt-btn-primary">Save Pre Call</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   POST-CALL MODAL
───────────────────────────────────────────────────────── */
function PostCallModal({ visit, onClose, onSave }) {
  const [brands, setBrands] = useState(visit.brands === "—" ? "" : visit.brands);
  const [campaign, setCampaign] = useState(visit.campaign === "—" ? "" : visit.campaign);
  const [outcome, setOutcome] = useState(visit.callOutcome || "Interested");
  const [prescriptions, setPrescriptions] = useState(visit.prescriptions || "");
  const [feedback, setFeedback] = useState(visit.feedback || "");
  const [nextVisit, setNextVisit] = useState(visit.nextVisitDate || "");

  function handleSave(e) {
    e.preventDefault();
    onSave({
      ...visit,
      brands: brands || "—",
      campaign: campaign || "—",
      callOutcome: outcome,
      prescriptions,
      feedback,
      nextVisitDate: nextVisit,
      status: "Reported",
    });
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal">
        <div className="rpt-call-modal-header">
          <div>
            <h2>Post Call — {visit.doctorName}</h2>
            <p className="rpt-call-modal-sub">Sno: {visit.advaitNo} · <span className="rpt-doc-tag">{visit.tag}</span></p>
            <p className="rpt-call-modal-sub">
              Phone: {visit.phone || "—"} · City: {visit.city || "—"} · Pin: {visit.pincode || "—"} · Specialization: {visit.tag || "—"}
            </p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <form id="postCallForm" className="rpt-call-form" onSubmit={handleSave}>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Product</label>
              <input
                value={brands}
                onChange={(e) => setBrands(e.target.value)}
                placeholder="e.g. Nebicard, Losar"
                required
              />
            </div>
            <div className="rpt-call-field">
              <label>Campaign / Sales Activity</label>
              <input
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g. HeartBeat 2026"
              />
            </div>
          </div>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Call Outcome *</label>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} required>
                <option>Interested</option>
                <option>Prescribed</option>
                <option>Needs Follow-up</option>
                <option>Not Available</option>
                <option>Rejected</option>
              </select>
            </div>
            <div className="rpt-call-field">
              <label>Next Visit Date</label>
              <input type="date" value={nextVisit} onChange={(e) => setNextVisit(e.target.value)} />
            </div>
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Prescriptions / Products Discussed</label>
            <input
              value={prescriptions}
              onChange={(e) => setPrescriptions(e.target.value)}
              placeholder="e.g. Nebicard 5mg — 10 strips/month"
            />
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Doctor Feedback / Observations</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did the doctor say? Any objections or requests?"
            />
          </div>
        </form>

        <div className="rpt-call-modal-footer">
          <button type="button" className="rpt-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="postCallForm" className="rpt-btn-primary rpt-btn-post-submit">
            ✓ Mark as Reported
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EDIT CALL MODAL (same shape as post call but pre-filled)
───────────────────────────────────────────────────────── */
function EditCallModal({ visit, onClose, onSave }) {
  return <PostCallModal visit={visit} onClose={onClose} onSave={onSave} />;
}

/* ─────────────────────────────────────────────────────────
   VIEW REPORTED CALLS MODAL
───────────────────────────────────────────────────────── */
function ReportedCallsModal({ visits, onClose }) {
  const reported = visits.filter((v) => v.status === "Reported");
  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-reported-modal">
        <div className="rpt-call-modal-header">
          <h2>Reported Calls ({reported.length})</h2>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="rpt-reported-body">
          {reported.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)", textAlign: "center", padding: "1.5rem 0" }}>No reported calls yet.</p>
          ) : (
            <div className="table-panel" style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".75rem" }}>
                <thead>
                  <tr>
                    <th>Sno</th>
                    <th>Doctor</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>Product</th>
                    <th>Discussed</th>
                    <th>Outcome</th>
                    <th>Next Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {reported.map((v) => (
                    <tr key={v.id}>
                      <td>{v.advaitNo}</td>
                      <td>
                        <div className="rpt-doc-cell">
                          <strong>{v.doctorName}</strong>
                          <span className="rpt-doc-tag">{v.tag}</span>
                        </div>
                      </td>
                      <td>{v.phone || "—"}</td>
                      <td>{v.city || "—"}</td>
                      <td style={{ color: "var(--primary)" }}>{v.brands}</td>
                      <td style={{ color: "oklch(52% .14 165)" }}>{v.campaign}</td>
                      <td>
                        {v.callOutcome ? (
                          <span className="rpt-outcome-badge">{v.callOutcome}</span>
                        ) : "—"}
                      </td>
                      <td>{v.nextVisitDate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="rpt-call-modal-footer">
          <button className="rpt-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SUBMIT TOAST
───────────────────────────────────────────────────────── */
function SubmitToast({ reportDate, reportingType, reported, total, recipientLabel, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="rpt-submit-toast">
      <div className="rpt-submit-toast-icon">✓</div>
      <div>
        <strong>Report Submitted Successfully!</strong>
        <p>{reportingType} · {reportDate} · {reported}/{total} visits reported</p>
        {recipientLabel && (
          <p style={{ marginTop: 3, fontSize: "0.76rem", opacity: 0.95 }}>
            Sent to: <strong>{recipientLabel}</strong>
          </p>
        )}
      </div>
      <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SUBMIT REPORT CONFIRMATION MODAL
───────────────────────────────────────────────────────── */
function SubmitReportModal({
  reportDate,
  reportingType,
  reportedCount,
  totalVisits,
  managerName,
  regionalManagerName,
  initialRecipient = "both",
  onClose,
  onSubmit,
}) {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [notes, setNotes] = useState("");
  const [includeAll, setIncludeAll] = useState(reportedCount === 0 || reportedCount < totalVisits);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    await onSubmit({ recipient, notes, includeAll });
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal" style={{ maxWidth: 540 }}>
        <div className="rpt-call-modal-header">
          <div>
            <h2>Submit Daily Visit Report</h2>
            <p className="rpt-call-modal-sub">{reportingType} · {reportDate} · {reportedCount} of {totalVisits} doctors logged</p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="rpt-call-form" style={{ padding: "1rem 1.25rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, display: "block" }}>
            Send Report To *
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                border: recipient === "both" ? "2px solid #0d9488" : "1px solid var(--border)",
                borderRadius: "8px",
                background: recipient === "both" ? "rgba(13, 148, 136, 0.06)" : "transparent",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="submitRecipient"
                checked={recipient === "both"}
                onChange={() => setRecipient("both")}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block" }}>
                  Both (Sales Manager & Regional Manager) <span style={{ fontSize: "0.75rem", background: "rgba(13,148,136,0.15)", color: "#0d9488", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>Recommended</span>
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                  Sends report to {managerName} (Sales Manager) and {regionalManagerName} (Regional Manager)
                </span>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                border: recipient === "manager" ? "2px solid #0d9488" : "1px solid var(--border)",
                borderRadius: "8px",
                background: recipient === "manager" ? "rgba(13, 148, 136, 0.06)" : "transparent",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="submitRecipient"
                checked={recipient === "manager"}
                onChange={() => setRecipient("manager")}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block" }}>
                  Sales Manager Only ({managerName})
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                  Sends report only to direct Sales Manager
                </span>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                border: recipient === "regional" ? "2px solid #0d9488" : "1px solid var(--border)",
                borderRadius: "8px",
                background: recipient === "regional" ? "rgba(13, 148, 136, 0.06)" : "transparent",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="submitRecipient"
                checked={recipient === "regional"}
                onChange={() => setRecipient("regional")}
                style={{ marginTop: 3 }}
              />
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block" }}>
                  Regional Manager Only ({regionalManagerName})
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                  Sends report directly to Regional Manager
                </span>
              </div>
            </label>
          </div>

          {reportedCount === 0 ? (
            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 12px", borderRadius: "8px", marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(e) => setIncludeAll(e.target.checked)}
                />
                Include all {totalVisits} scheduled doctors in today's submission
              </label>
              <p style={{ margin: "4px 0 0 24px", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                Doctors in your list will be submitted as completed visits for {reportDate}.
              </p>
            </div>
          ) : reportedCount < totalVisits ? (
            <div style={{ background: "rgba(13, 148, 136, 0.06)", border: "1px solid rgba(13, 148, 136, 0.2)", padding: "10px 12px", borderRadius: "8px", marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(e) => setIncludeAll(e.target.checked)}
                />
                Also include remaining {totalVisits - reportedCount} pending doctors as completed visits
              </label>
              <p style={{ margin: "4px 0 0 24px", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                Currently {reportedCount} of {totalVisits} doctors have detailed post-call records.
              </p>
            </div>
          ) : (
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "8px 12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.82rem", color: "#059669", fontWeight: 600 }}>
              ✓ All {totalVisits} doctors have been logged and reported.
            </div>
          )}

          <div className="rpt-call-field rpt-call-field-full">
            <label>Executive Remarks / Notes for Management (Optional)</label>
            <textarea
              rows={3}
              placeholder="e.g. Completed scheduled clinic visits in Koramangala. Product detailing done for key doctors..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="rpt-call-modal-footer">
          <button type="button" className="rpt-btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="rpt-btn-primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : "Confirm & Send Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   REPORT DETAILS MODAL (FULL VIEW FOR MANAGERS & EXECUTIVES)
───────────────────────────────────────────────────────── */
function ReportDetailsModal({ report, role, onClose, onFeedbackSaved, onDelete }) {
  const isManager = role === "manager";
  const isRegional = role === "regional";
  const [managerRemarks, setManagerRemarks] = useState(report.manager_remarks || "");
  const [regionalRemarks, setRegionalRemarks] = useState(report.regional_remarks || "");
  const [saving, setSaving] = useState(false);

  const visits = useMemo(() => {
    try {
      return JSON.parse(report.visits_json || "[]");
    } catch {
      return [];
    }
  }, [report.visits_json]);

  async function handleSaveReview() {
    setSaving(true);
    const updates = {
      status: "Reviewed",
      ...(isManager ? { manager_remarks: managerRemarks } : {}),
      ...(isRegional ? { regional_remarks: regionalRemarks } : {}),
    };
    await updateSubmissionReport(report.id, updates);
    setSaving(false);
    if (onFeedbackSaved) onFeedbackSaved(report.id, updates);
    onClose();
  }

  const recipientLabel =
    report.recipient_type === "both"
      ? `Sales Manager (${report.manager_name || "Manager"}) & Regional Manager (${report.regional_manager_name || "RM"})`
      : report.recipient_type === "manager"
        ? `Sales Manager (${report.manager_name || "Manager"})`
        : `Regional Manager (${report.regional_manager_name || "RM"})`;

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal" style={{ maxWidth: 800, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="rpt-call-modal-header">
          <div>
            <h2>Daily Visit Report — {report.executive_name}</h2>
            <p className="rpt-call-modal-sub">
              {report.employee_code || "SE"} · {report.region || "Territory"} · {report.report_date} · {report.reporting_type}
            </p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <div style={{ padding: "1rem 1.25rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", background: "var(--accent)", padding: "10px 14px", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted-foreground)" }}>Sent To:</span>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--foreground)" }}>{recipientLabel}</span>
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
              Submitted: {new Date(report.submitted_at).toLocaleString()}
            </span>
          </div>

          {report.summary_notes && (
            <div style={{ background: "rgba(13, 148, 136, 0.05)", borderLeft: "3px solid #0d9488", padding: "8px 12px", borderRadius: "4px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: 0.5 }}>Executive Summary Notes</span>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--foreground)" }}>{report.summary_notes}</p>
            </div>
          )}

          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>Reported Doctor Visits ({visits.length})</h4>
            {visits.length === 0 ? (
              <p className="doc-muted">No individual doctor visit records.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {visits.map((v, idx) => (
                  <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", background: "var(--card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <strong>{v.doctorName || `Doctor #${v.advaitNo}`}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: 2 }}>
                          {v.tag} · {v.city} · {v.pincode} · {v.phone}
                        </div>
                      </div>
                      <span className="rpt-status-badge reported">Reported</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.82rem", background: "var(--accent)", padding: "8px", borderRadius: "6px" }}>
                      <div>
                        <span style={{ color: "var(--muted-foreground)" }}>Product / Brands: </span>
                        <strong>{v.brands || "—"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--muted-foreground)" }}>Campaign: </span>
                        <strong>{v.campaign || "—"}</strong>
                      </div>
                      {v.preCallObjective && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ color: "var(--muted-foreground)" }}>Pre-Call Objective: </span>
                          <span>{v.preCallObjective}</span>
                        </div>
                      )}
                      {v.callOutcome && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ color: "var(--muted-foreground)" }}>Call Outcome: </span>
                          <span>{v.callOutcome}</span>
                        </div>
                      )}
                      {v.feedback && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span style={{ color: "var(--muted-foreground)" }}>Doctor Feedback: </span>
                          <span>{v.feedback}</span>
                        </div>
                      )}
                      {v.nextVisitDate && (
                        <div>
                          <span style={{ color: "var(--muted-foreground)" }}>Next Visit: </span>
                          <strong>{v.nextVisitDate}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback & Review section */}
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Management Review & Remarks</h4>

            {report.manager_remarks && !isManager && (
              <div style={{ background: "var(--accent)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.82rem" }}>
                <strong style={{ color: "#0d9488" }}>Sales Manager Remarks ({report.manager_name || "Manager"}):</strong>
                <p style={{ margin: "4px 0 0" }}>{report.manager_remarks}</p>
              </div>
            )}

            {report.regional_remarks && !isRegional && (
              <div style={{ background: "var(--accent)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.82rem" }}>
                <strong style={{ color: "#2563eb" }}>Regional Manager Remarks ({report.regional_manager_name || "RM"}):</strong>
                <p style={{ margin: "4px 0 0" }}>{report.regional_remarks}</p>
              </div>
            )}

            {isManager && (
              <div className="rpt-call-field rpt-call-field-full">
                <label>Sales Manager Feedback / Coaching Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter feedback or acknowledgement for this executive…"
                  value={managerRemarks}
                  onChange={(e) => setManagerRemarks(e.target.value)}
                />
              </div>
            )}

            {isRegional && (
              <div className="rpt-call-field rpt-call-field-full">
                <label>Regional Manager Directives / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Enter regional directives or acknowledgement for this executive…"
                  value={regionalRemarks}
                  onChange={(e) => setRegionalRemarks(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rpt-call-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {(isManager || isRegional) && onDelete && (
              <button
                type="button"
                className="rpt-btn-danger"
                onClick={() => onDelete(report.id)}
                disabled={saving}
              >
                Delete Report
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="rpt-btn-outline" onClick={onClose} disabled={saving}>
              Close
            </button>
            {(isManager || isRegional) && (
              <button type="button" className="rpt-btn-primary" onClick={handleSaveReview} disabled={saving}>
                {saving ? "Saving…" : "Save Remarks & Mark Reviewed"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EXECUTIVE SUBMISSION HISTORY MODAL
───────────────────────────────────────────────────────── */
function ExecutiveSubmissionHistoryModal({ execId, onClose }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailReport, setDetailReport] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const list = await fetchSubmissionReports({ executiveId: execId });
      setReports(list);
      setLoading(false);
    }
    load();
  }, [execId]);

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal" style={{ maxWidth: 740 }}>
        <div className="rpt-call-modal-header">
          <div>
            <h2>My Submitted Daily Reports</h2>
            <p className="rpt-call-modal-sub">History of submitted visit reports to Management</p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <div style={{ padding: "1rem 1.25rem", maxHeight: "65vh", overflowY: "auto" }}>
          {loading ? (
            <p className="rpt-empty-state">Loading history…</p>
          ) : reports.length === 0 ? (
            <p className="rpt-empty-state">No reports submitted yet.</p>
          ) : (
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Sent To</th>
                  <th>Reported</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const recipientLabel =
                    r.recipient_type === "both"
                      ? "Manager & RM"
                      : r.recipient_type === "manager"
                        ? "Sales Manager"
                        : "Regional Manager";
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.report_date}</td>
                      <td>{r.reporting_type}</td>
                      <td>
                        <span className="rpt-doc-tag">{recipientLabel}</span>
                      </td>
                      <td>
                        {r.reported_visits} / {r.total_visits}
                      </td>
                      <td>
                        <span className={"rpt-status-badge " + (r.status === "Reviewed" ? "reported" : "not-reported")}>
                          {r.status || "Submitted"}
                        </span>
                      </td>
                      <td>
                        <button className="rpt-btn-sm rpt-btn-outline" onClick={() => setDetailReport(r)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rpt-call-modal-footer">
          <button type="button" className="rpt-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>

        {detailReport && (
          <ReportDetailsModal
            report={detailReport}
            role="executive"
            onClose={() => setDetailReport(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   RECEIVED REPORTS SECTION (FOR SALES MANAGERS & REGIONAL MANAGERS)
───────────────────────────────────────────────────────── */
function ReceivedReportsSection({ data, role, currentRecord }) {
  const isManager = role === "manager";
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecId, setSelectedExecId] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [activeReport, setActiveReport] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const list = await fetchSubmissionReports({ forRole: role });
    setReports(list);
    setLoading(false);
  }, [role]);

  useEffect(() => {
    const t = setTimeout(() => loadReports(), 0);
    return () => clearTimeout(t);
  }, [loadReports]);

  function handleFeedbackSaved(reportId, updates) {
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...updates } : r)));
  }

  async function handleDeleteReport(reportId, e) {
    if (e) e.stopPropagation();
    const confirmed = window.confirm(
      "Are you sure you want to delete this executive report? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(reportId);
    try {
      await deleteSubmissionReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (activeReport?.id === reportId) {
        setActiveReport(null);
      }
    } catch (err) {
      console.error("Failed to delete submission report:", err);
      alert("Failed to delete report. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (selectedExecId !== "all" && String(r.executive_id) !== String(selectedExecId)) return false;
      if (dateFilter && r.report_date !== dateFilter) return false;
      return true;
    });
  }, [reports, selectedExecId, dateFilter]);

  return (
    <div className="rpt-wrap">
      {/* ── TOP BANNER & CONTROLS ── */}
      <div className="panel rpt-controls">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
              {isManager ? "Received Executive Visit Reports" : "Regional Executive Visit Reports"}
            </h2>
            <p className="doc-muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>
              {isManager
                ? `Reports submitted by team executives to Sales Manager: ${currentRecord?.name || "Emily"}`
                : `Reports submitted across the region to Regional Manager: ${currentRecord?.name || "John"}`}
            </p>
          </div>
        </div>

        <div className="rpt-control-row">
          <div className="rpt-field">
            <label>Filter by Executive</label>
            <select value={selectedExecId} onChange={(e) => setSelectedExecId(e.target.value)}>
              <option value="all">All Executives ({data.executives?.length || 0})</option>
              {data.executives?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employee_code || `SE-00${e.id}`}) · {e.region || "Territory"}
                </option>
              ))}
            </select>
          </div>
          <div className="rpt-field">
            <label>Filter by Date</label>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          {dateFilter && (
            <button className="rpt-btn-outline" onClick={() => setDateFilter("")} style={{ height: 36 }}>
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* ── REPORTS TABLE ── */}
      <div className="panel table-panel rpt-table-panel">
        {loading ? (
          <p className="rpt-empty-state">Loading submitted reports…</p>
        ) : filteredReports.length === 0 ? (
          <p className="rpt-empty-state">No executive reports found matching the selected filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Sales Executive</th>
                <th>Type</th>
                <th>Sent To</th>
                <th>Doctors Reported</th>
                <th>Summary Notes</th>
                <th>Status</th>
                <th>Option</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => {
                const recipientLabel =
                  r.recipient_type === "both"
                    ? "Manager & RM"
                    : r.recipient_type === "manager"
                      ? "Sales Manager"
                      : "Regional Manager";
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.report_date}</td>
                    <td>
                      <div className="rpt-doc-cell">
                        <div className="rpt-doc-avatar">{r.executive_name?.charAt(0) || "E"}</div>
                        <div>
                          <strong>{r.executive_name}</strong>
                          <div className="rpt-doc-pin" style={{ marginTop: 2 }}>
                            {r.employee_code || "SE"} · {r.region || "Territory"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rpt-brands">{r.reporting_type || "Field"}</span>
                    </td>
                    <td>
                      <span
                        className="rpt-doc-tag"
                        style={{
                          background: r.recipient_type === "both" ? "rgba(13,148,136,0.12)" : "rgba(37,99,235,0.12)",
                          color: r.recipient_type === "both" ? "#0d9488" : "#2563eb",
                          fontWeight: 600,
                        }}
                      >
                        {recipientLabel}
                      </span>
                    </td>
                    <td>
                      <strong>{r.reported_visits}</strong> / {r.total_visits} doctors
                    </td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.summary_notes || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                    </td>
                    <td>
                      <span className={"rpt-status-badge " + (r.status === "Reviewed" ? "reported" : "not-reported")}>
                        {r.status || "Submitted"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button className="rpt-btn-sm rpt-btn-post" onClick={() => setActiveReport(r)}>
                          View Full Report
                        </button>
                        <button
                          type="button"
                          className="rpt-btn-sm rpt-btn-danger"
                          onClick={(e) => handleDeleteReport(r.id, e)}
                          disabled={deletingId === r.id}
                          title="Delete report"
                        >
                          {deletingId === r.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {activeReport && (
        <ReportDetailsModal
          report={activeReport}
          role={role}
          currentRecord={currentRecord}
          onClose={() => setActiveReport(null)}
          onFeedbackSaved={handleFeedbackSaved}
          onDelete={handleDeleteReport}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   REPORTS VIEW
   - Seeded from real API doctors in the exec's territory
   - Executive: submit reports to Manager, Regional Manager, or Both
   - Manager & Regional Manager: review received reports & give coaching feedback
───────────────────────────────────────────────────────── */
function ViewDoctorModal({ doctor, onClose }) {
  if (!doctor) return null;
  
  const docName = doctor.doctorName || doctor.name || "—";
  const spec = doctor.specializations || doctor.specialization || doctor.tag || "—";
  const cleanName = docName.replace(/^dr\.?\s*/i, '').trim();
  const avatarChar = cleanName.length > 0 ? cleanName.charAt(0).toUpperCase() : "D";

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal" style={{ maxWidth: 450, borderRadius: 12, overflow: "hidden", padding: 0 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
          
          <div style={{ 
            width: 44, height: 44, borderRadius: '50%', backgroundColor: '#e0f7fa', color: 'var(--primary, #00796b)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.15rem' 
          }}>
            {avatarChar}
          </div>
          
          <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>{docName}</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{spec}</span>
          </div>
          
          <button onClick={onClose} style={{ 
            background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#94a3b8', 
            padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0.5rem 1.5rem 1.5rem 1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'Specialization', value: spec },
              { label: 'Qualification', value: doctor.qualification || "—" },
              { label: 'Phone Number', value: doctor.phone || "—" },
              { label: 'City', value: doctor.city || "—" },
              { label: 'Pin Code', value: doctor.pincode || doctor.location || "—" },
              { label: 'Experience', value: doctor.experience_years != null ? `${doctor.experience_years} yrs` : "—" },
            ].map((item, idx, arr) => (
              <div key={idx} style={{ 
                display: 'flex', justifyContent: 'space-between', padding: '0.9rem 0', 
                borderBottom: idx === arr.length - 1 ? 'none' : '1px dashed #cbd5e1', 
                fontSize: '0.85rem' 
              }}>
                <span style={{ color: '#64748b' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function ReportsView({ data, execId, role, managerId, regionalId, currentRecord }) {
  const isManager = role === ROLES.MANAGER || role === ROLES.REGIONAL;
  const [managerViewMode, setManagerViewMode] = useState("received"); // "received" | "create"
  const today = new Date().toISOString().slice(0, 10);
  const [reportingType, setReportingType] = useState("Field");
  const [reportDate, setReportDate] = useState(today);
  const [recipientType, setRecipientType] = useState("both"); // "both" | "manager" | "regional"
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal states
  const [preCallVisit, setPreCallVisit] = useState(null);
  const [postCallVisit, setPostCallVisit] = useState(null);
  const [editCallVisit, setEditCallVisit] = useState(null);
  const [showReported, setShowReported] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmissionReceipt, setLastSubmissionReceipt] = useState(null);
  const [viewingDoctor, setViewingDoctor] = useState(null);

  // The visits list — seeded from real API doctors in the exec's territory
  const exec = data.executives.find((e) => e.id === execId) || data.executives[0];

  const salesManager = data.salesManagers?.find((m) => m.id === managerId) || data.salesManagers?.[0];
  const regionalManager = data.regionalManagers?.find((r) => r.id === regionalId) || data.regionalManagers?.[0];
  const managerName = salesManager?.name || "Emily";
  const regionalManagerName = regionalManager?.name || "John";

  const myPincodes = useMemo(
    () => new Set(data.coverage.filter((c) => c.executive_id === exec?.id).map((c) => c.pincode)),
    [data.coverage, exec]
  );

  const territoryDoctors = useMemo(() => {
    if (!data.doctors || data.doctors.length === 0) return [];
    // 1. Doctors matching assigned pincodes
    let list = data.doctors.filter((d) => myPincodes.has(d.pincode));
    // 2. If no coverage pincodes assigned or no match, match by executive's city or region
    if (list.length === 0 && exec) {
      list = data.doctors.filter((d) => {
        const docCity = (d.city || "").toLowerCase().trim();
        const execCity = (exec.city || "").toLowerCase().trim();
        const execRegion = (exec.region || "").toLowerCase().trim();
        const isCityMatch = execCity && (docCity === execCity || (docCity.includes("bang") && execCity.includes("bang")));
        const isRegionMatch = execRegion && (docCity.includes(execRegion) || (d.name || "").toLowerCase().includes(execRegion));
        return isCityMatch || isRegionMatch;
      });
    }
    // 3. Fallback to all available doctors so executive is never blocked
    if (list.length === 0) {
      list = data.doctors;
    }
    return list;
  }, [data.doctors, myPincodes, exec]);

  // Visits in today's report
  const [visits, setVisits] = useState([]);

  // Check if a report was already submitted for today / selected reportDate
  useEffect(() => {
    let mounted = true;
    async function checkExisting() {
      if (!exec?.id || isManager) return;
      const list = await fetchSubmissionReports({ executiveId: exec.id, reportDate });
      if (!mounted) return;
      if (list && list.length > 0) {
        const latest = list[0];
        setSubmitted(true);
        setLastSubmissionReceipt({
          recipientLabel:
            latest.recipient_type === "both"
              ? `${managerName} (Sales Manager) & ${regionalManagerName} (Regional Manager)`
              : latest.recipient_type === "manager"
                ? `${managerName} (Sales Manager)`
                : `${regionalManagerName} (Regional Manager)`,
          count: latest.reported_visits || latest.total_visits || 0,
          report: latest,
        });
        if (latest.visits_json) {
          try {
            const savedVisits = JSON.parse(latest.visits_json);
            if (Array.isArray(savedVisits) && savedVisits.length > 0) {
              setVisits(savedVisits);
              setSelectedIds(new Set());
              return;
            }
          } catch { /* ignore */ }
        }
      } else {
        setSubmitted(false);
        setLastSubmissionReceipt(null);
      }
    }
    checkExisting();
    return () => { mounted = false; };
  }, [exec?.id, reportDate, isManager, managerName, regionalManagerName]);

  // Dropdown search — doctors from region not yet in the visit list
  const addableDoctors = useMemo(() => {
    const inList = new Set(visits.map((v) => v.id));
    const term = doctorSearch.trim().toLowerCase();
    return territoryDoctors.filter((d) => {
      if (inList.has(d.id)) return false;
      if (!term) return true;
      return (
        d.name?.toLowerCase().includes(term) ||
        d.qualification?.toLowerCase().includes(term) ||
        d.specializations?.toLowerCase().includes(term) ||
        String(d.id).includes(term) ||
        String(d.pincode ?? "").includes(term) ||
        (d.city && d.city.toLowerCase().includes(term))
      );
    });
  }, [territoryDoctors, visits, doctorSearch]);

  function handleAddDoctor() {
    if (!selectedDoctor) return;
    const doc = data.doctors.find((d) => String(d.id) === String(selectedDoctor))
      || territoryDoctors.find((d) => String(d.id) === String(selectedDoctor));
    if (!doc) return;
    if (visits.some((v) => v.id === doc.id)) {
      setSelectedDoctor("");
      return;
    }
    setVisits((prev) => [
      ...prev,
      {
        id: doc.id,
        advaitNo: String(doc.id),
        doctorName: doc.name?.toUpperCase() ?? "UNKNOWN",
        tag: doc.specializations
          ? doc.specializations.split(",")[0].trim().toUpperCase().slice(0, 6)
          : "GEN",
        qualification: doc.qualification || "",
        pincode: doc.pincode,
        phone: doc.phone || "—",
        city: doc.city || "—",
        brands: "—",
        campaign: "—",
        status: "Not Reported",
        preCallObjective: "",
        preCallNotes: "",
        callOutcome: "",
        prescriptions: "",
        feedback: "",
        nextVisitDate: "",
      },
    ]);
    setSelectedDoctor("");
  }

  function handleAddAllDoctors() {
    const inList = new Set(visits.map((v) => v.id));
    const toAdd = territoryDoctors.filter((d) => !inList.has(d.id));
    if (toAdd.length === 0) return;
    setVisits((prev) => [
      ...prev,
      ...toAdd.map((doc) => ({
        id: doc.id,
        advaitNo: String(doc.id),
        doctorName: doc.name?.toUpperCase() ?? "UNKNOWN",
        tag: doc.specializations
          ? doc.specializations.split(",")[0].trim().toUpperCase().slice(0, 6)
          : "GEN",
        qualification: doc.qualification || "",
        pincode: doc.pincode,
        phone: doc.phone || "—",
        city: doc.city || "—",
        brands: "—",
        campaign: "—",
        status: "Not Reported",
        preCallObjective: "",
        preCallNotes: "",
        callOutcome: "",
        prescriptions: "",
        feedback: "",
        nextVisitDate: "",
      })),
    ]);
  }

  function handleRemoveVisits() {
    if (selectedIds.size > 0) {
      setVisits((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
    } else {
      setVisits((prev) => prev.filter((v) => v.status !== "Not Reported"));
    }
  }

  function handleMarkSelectedReported() {
    if (selectedIds.size === 0) return;
    setVisits((prev) =>
      prev.map((v) =>
        selectedIds.has(v.id)
          ? {
            ...v,
            status: "Reported",
            callOutcome: v.callOutcome || "Interested",
            brands: v.brands === "—" ? "Standard Detailing" : v.brands,
          }
          : v
      )
    );
    setSelectedIds(new Set());
  }

  function handleUpdateVisit(updated) {
    setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }

  function handleFinalSubmit() {
    if (visits.length === 0) {
      alert("No visits in your list to submit. Please add doctors from your region first.");
      return;
    }
    setShowSubmitModal(true);
  }

  async function handleConfirmSubmit({ recipient, notes, includeAll }) {
    let visitsToSubmit;
    if (includeAll) {
      visitsToSubmit = visits.map((v) => ({
        ...v,
        status: "Reported",
        callOutcome: v.callOutcome || "Interested",
        brands: v.brands === "—" ? "Standard Detailing" : v.brands,
      }));
      setVisits(visitsToSubmit);
    } else {
      const reportedOnly = visits.filter((v) => v.status === "Reported");
      if (reportedOnly.length === 0) {
        visitsToSubmit = visits.map((v) => ({
          ...v,
          status: "Reported",
          callOutcome: v.callOutcome || "Interested",
          brands: v.brands === "—" ? "Standard Detailing" : v.brands,
        }));
        setVisits(visitsToSubmit);
      } else {
        visitsToSubmit = reportedOnly;
      }
    }

    const recipientLabel =
      recipient === "both"
        ? `${managerName} (Sales Manager) & ${regionalManagerName} (Regional Manager)`
        : recipient === "manager"
          ? `${managerName} (Sales Manager)`
          : `${regionalManagerName} (Regional Manager)`;

    const payload = {
      executive_id: exec.id,
      executive_name: exec.name,
      employee_code: exec.employee_code || `SE-00${exec.id}`,
      region: exec.region || "Bengaluru",
      report_date: reportDate,
      reporting_type: reportingType,
      recipient_type: recipient,
      manager_id: salesManager?.id,
      manager_name: managerName,
      regional_manager_id: regionalManager?.id,
      regional_manager_name: regionalManagerName,
      total_visits: visits.length,
      reported_visits: visitsToSubmit.length,
      summary_notes: notes,
      visits_json: JSON.stringify(visitsToSubmit),
      status: "Submitted",
    };

    const saved = await createSubmissionReport(payload);
    setSubmitted(true);
    setLastSubmissionReceipt({
      recipientLabel,
      count: visitsToSubmit.length,
      report: saved,
    });
    setShowToast(true);
    setSelectedIds(new Set());
  }

  // Filtered display
  const filteredVisits = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase();
    return visits.filter((v) => {
      const matchSearch =
        !term ||
        v.doctorName.toLowerCase().includes(term) ||
        v.advaitNo.includes(term) ||
        v.tag.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "reported" && v.status === "Reported") ||
        (statusFilter === "not_reported" && v.status === "Not Reported");
      return matchSearch && matchStatus;
    });
  }, [visits, doctorSearch, statusFilter]);

  const allFilteredSelected =
    filteredVisits.length > 0 && filteredVisits.every((v) => selectedIds.has(v.id));
  const someFilteredSelected =
    filteredVisits.some((v) => selectedIds.has(v.id)) && !allFilteredSelected;

  function handleToggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVisits.map((v) => v.id)));
    }
  }

  function handleToggleSelectRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const reportedCount = visits.filter((v) => v.status === "Reported").length;
  const pendingCount = visits.length - reportedCount;

  const isLoading = data.loading;
  const noDoctors = !isLoading && territoryDoctors.length === 0;

  // If role is Manager or Regional Manager, provide view switch
  if (isManager && managerViewMode === "received") {
    return <ReceivedReportsSection data={data} role={role} currentRecord={currentRecord} />;
  }

  return (
    <div className="rpt-wrap">
      {isManager && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <button
            className="rpt-btn-primary"
            style={{ fontSize: "0.8rem", height: 32 }}
            onClick={() => setManagerViewMode("received")}
          >
            ← Back to Received Reports
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
            Creating report as {role === "regional" ? "Regional Manager" : "Sales Manager"}
          </span>
        </div>
      )}

      {/* ── TOAST ── */}
      {showToast && (
        <SubmitToast
          reportDate={reportDate}
          reportingType={reportingType}
          reported={reportedCount}
          total={visits.length}
          recipientLabel={lastSubmissionReceipt?.recipientLabel}
          onClose={() => setShowToast(false)}
        />
      )}

      {submitted && lastSubmissionReceipt && (
        <div style={{ padding: "10px 14px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem", color: "#059669" }}>✓</span>
            <div>
              <strong style={{ color: "#059669" }}>Daily Report Submitted for {reportDate}</strong>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                Successfully sent to: <strong>{lastSubmissionReceipt.recipientLabel}</strong> ({lastSubmissionReceipt.count} visits)
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {lastSubmissionReceipt.report && (
              <button
                className="rpt-btn-outline"
                style={{ height: 30, fontSize: "0.78rem" }}
                onClick={() => setViewingReport(lastSubmissionReceipt.report)}
              >
                View Submitted Report
              </button>
            )}
            <button
              className="rpt-btn-outline"
              style={{ height: 30, fontSize: "0.78rem" }}
              onClick={() => setSubmitted(false)}
            >
              Edit / Resubmit
            </button>
          </div>
        </div>
      )}

      {/* ── TOP CONTROLS ── */}
      <div className="panel rpt-controls">
        <div className="rpt-control-row">
          <div className="rpt-field">
            <label>Reporting Type *</label>
            <select value={reportingType} onChange={(e) => setReportingType(e.target.value)}>
              <option>Field</option>
              <option>Office</option>
              <option>Virtual</option>
            </select>
          </div>
          <div className="rpt-field">
            <label>Report Date *</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
          <div className="rpt-field">
            <label>Send Report To *</label>
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)}>
              <option value="both">Both (Sales Manager & Regional Manager)</option>
              <option value="manager">Sales Manager ({managerName})</option>
              <option value="regional">Regional Manager ({regionalManagerName})</option>
            </select>
          </div>
          <div className="rpt-control-actions">
            <button
              className="rpt-btn-outline"
              onClick={() => setShowReported(true)}
            >
              View Reported Calls ({reportedCount})
            </button>
            <button
              className="rpt-btn-outline"
              onClick={() => setShowHistoryModal(true)}
            >
              Submission History
            </button>
            <button
              className={"rpt-btn-primary" + (submitted ? " rpt-btn-success" : "")}
              style={{
                fontWeight: 600,
                background: submitted ? "oklch(48% .12 165)" : undefined,
              }}
              onClick={handleFinalSubmit}
              title={submitted ? "Report already sent — click to resubmit" : "Send daily report to management"}
            >
              {submitted ? "✓ Report Sent" : "Send Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── ADD DOCTOR ROW ── */}
      <div className="panel rpt-add-row">
        <div className="rpt-search-wrap">
          <label>Search Doctor</label>
          <div className="rpt-search-input-wrap">
            <input
              type="text"
              placeholder="Type name, S No., or speciality…"
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
            />
            <span className="rpt-search-icon"><VscSearch /></span>
          </div>
        </div>

        <div className="rpt-select-wrap">
          <label>Select Doctor</label>
          <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
            <option value="">
              {addableDoctors.length === 0 && territoryDoctors.length > 0
                ? `— All region doctors added (${territoryDoctors.length}) —`
                : addableDoctors.length === 0
                  ? "— No doctors found in region —"
                  : `— Choose Doctor from Region (${addableDoctors.length}) —`}
            </option>
            {addableDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.specializations ? ` · ${d.specializations.split(",")[0].trim()}` : ""}{d.city ? ` (${d.city})` : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          className="rpt-btn-primary"
          onClick={handleAddDoctor}
          disabled={!selectedDoctor}
          title={selectedDoctor ? "Add selected doctor to today's visit list" : "Please choose a doctor first"}
        >
          + Add
        </button>

        {addableDoctors.length > 0 && (
          <button
            className="rpt-btn-outline"
            style={{ fontWeight: 600 }}
            onClick={handleAddAllDoctors}
            title="Add all available doctors from your region to today's report"
          >
            + Add All ({addableDoctors.length})
          </button>
        )}

        {selectedIds.size > 0 ? (
          <>
            <button
              className="rpt-btn-outline"
              style={{ color: "#0d9488", borderColor: "#0d9488", fontWeight: 600 }}
              onClick={handleMarkSelectedReported}
            >
              ✓ Mark Selected as Reported ({selectedIds.size})
            </button>
            <button
              className="rpt-btn-danger"
              onClick={handleRemoveVisits}
            >
              Remove Selected ({selectedIds.size})
            </button>
          </>
        ) : (
          <button className="rpt-btn-danger" onClick={handleRemoveVisits}>
            Remove Visit Details
          </button>
        )}
      </div>

      {/* ── INDICATION / STATUS FILTER ROW ── */}
      <div className="panel rpt-filter-row">
        <div className="rpt-status-filter">
          <span>Reporting Status:</span>
          <label>
            <input type="radio" name="rptStatus" checked={statusFilter === "all"} onChange={() => setStatusFilter("all")} />
            All
          </label>
          <label>
            <input type="radio" name="rptStatus" checked={statusFilter === "reported"} onChange={() => setStatusFilter("reported")} />
            Reported
          </label>
          <label>
            <input type="radio" name="rptStatus" checked={statusFilter === "not_reported"} onChange={() => setStatusFilter("not_reported")} />
            Not Reported
          </label>
        </div>
      </div>

      {/* ── VISITS TABLE ── */}
      <div className="panel table-panel rpt-table-panel">
        {isLoading ? (
          <p className="rpt-empty-state">Loading doctors from your territory…</p>
        ) : noDoctors ? (
          <p className="rpt-empty-state">No doctors found in your assigned region.</p>
        ) : visits.length === 0 ? (
          <div className="rpt-empty-state" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "1.05rem", fontWeight: 600 }}>No visits added for today's report yet.</p>
            <p style={{ margin: "0 0 1.25rem", color: "var(--muted-foreground)", fontSize: "0.85rem" }}>
              Select a doctor from your region above and click <strong>+ Add</strong>, or add all doctors at once to begin reporting.
            </p>
            {territoryDoctors.length > 0 && (
              <button
                className="rpt-btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleAddAllDoctors}
              >
                + Add All Region Doctors ({territoryDoctors.length})
              </button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => { if (el) el.indeterminate = someFilteredSelected; }}
                    onChange={handleToggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th>Sno</th>
                <th>Doctor Name</th>
                <th>Product</th>
                <th>Discussed</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>View</th>
                <th>Option</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="rpt-empty-td">No visits match your filter.</td>
                </tr>
              ) : (
                filteredVisits.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(v.id)}
                        onChange={() => handleToggleSelectRow(v.id)}
                      />
                    </td>
                    <td className="rpt-advait-no">{v.advaitNo}</td>
                    <td>
                      <div className="rpt-doc-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', backgroundColor: '#e0f7fa', color: 'var(--primary, #00796b)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', flexShrink: 0
                        }}>
                          {(v.doctorName || "").replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || "D"}
                        </div>
                        <div>
                          {v.doctorName}
                        </div>
                      </div>
                    </td>
                    <td>
                      {v.brands === "—"
                        ? <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        : <span className="rpt-brands">{v.brands}</span>
                      }
                    </td>
                    <td>
                      {v.campaign === "—"
                        ? <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        : <span className="rpt-campaign">{v.campaign}</span>
                      }
                    </td>
                    <td>
                      <span className={"rpt-status-badge" + (v.status === "Reported" ? " reported" : " not-reported")}>
                        {v.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="rpt-btn-outline"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "var(--primary)",
                          color: "var(--primary)"
                        }}
                        title="View Doctor Details"
                        onClick={() => {
                          const fullDoc = territoryDoctors.find(d => d.id === v.id) || data.doctors?.find(d => d.id === v.id) || {};
                          setViewingDoctor({ ...fullDoc, ...v });
                        }}
                      >
                        <VscEye size={18} />
                      </button>
                    </td>
                    <td>
                      <div className="rpt-options">
                        <button
                          className="rpt-btn-sm rpt-btn-outline"
                          onClick={() => setPreCallVisit(v)}
                          title="Fill pre-call details"
                        >
                          Pre Call
                        </button>
                        {v.status === "Reported" ? (
                          <button
                            className="rpt-btn-sm rpt-btn-edit"
                            onClick={() => setEditCallVisit(v)}
                            title="Edit reported call"
                          >
                            Edit Call
                          </button>
                        ) : (
                          <button
                            className="rpt-btn-sm rpt-btn-post"
                            onClick={() => setPostCallVisit(v)}
                            title="Mark as reported"
                          >
                            Post Call
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="rpt-footer">
        <span className="rpt-summary">
          Total Visits in List: <strong>{visits.length}</strong>&nbsp;|&nbsp;
          Reported: <strong>{reportedCount}</strong>&nbsp;|&nbsp;
          Pending: <strong>{pendingCount}</strong>
          {selectedIds.size > 0 && (
            <span style={{ marginLeft: 12, color: "var(--primary)", fontWeight: 600 }}>
              ({selectedIds.size} selected)
            </span>
          )}
        </span>
      </div>

      {/* ── MODALS ── */}
      {showSubmitModal && (
        <SubmitReportModal
          reportDate={reportDate}
          reportingType={reportingType}
          reportedCount={reportedCount}
          totalVisits={visits.length}
          managerName={managerName}
          regionalManagerName={regionalManagerName}
          initialRecipient={recipientType}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={handleConfirmSubmit}
        />
      )}

      {showHistoryModal && (
        <ExecutiveSubmissionHistoryModal
          execId={exec.id}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {viewingReport && (
        <ReportDetailsModal
          report={viewingReport}
          role={role}
          currentRecord={currentRecord}
          onClose={() => setViewingReport(null)}
        />
      )}

      {viewingDoctor && (
        <ViewDoctorModal
          doctor={viewingDoctor}
          onClose={() => setViewingDoctor(null)}
        />
      )}

      {preCallVisit && (
        <PreCallModal
          visit={preCallVisit}
          onClose={() => setPreCallVisit(null)}
          onSave={(updated) => { handleUpdateVisit(updated); setPreCallVisit(null); }}
        />
      )}
      {postCallVisit && (
        <PostCallModal
          visit={postCallVisit}
          onClose={() => setPostCallVisit(null)}
          onSave={(updated) => { handleUpdateVisit(updated); setPostCallVisit(null); }}
        />
      )}
      {editCallVisit && (
        <EditCallModal
          visit={editCallVisit}
          onClose={() => setEditCallVisit(null)}
          onSave={(updated) => { handleUpdateVisit(updated); setEditCallVisit(null); }}
        />
      )}
      {showReported && (
        <ReportedCallsModal visits={visits} onClose={() => setShowReported(false)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DOCTORS VIEW
   - Real-time doctors from API filtered by exec's pincodes
   - Proper heading matching Reports page style
   - Consistent CSS classes
───────────────────────────────────────────────────────── */
function DoctorsView({ data, execId }) {
  const [search, setSearch] = useState("");
  const [filterPincode, setFilterPincode] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const exec = data.executives.find((e) => e.id === execId) || data.executives[0];

  const myPincodes = useMemo(
    () => new Set(data.coverage.filter((c) => c.executive_id === exec?.id).map((c) => c.pincode)),
    [data.coverage, exec]
  );

  const myDoctors = useMemo(() => {
    if (!data.doctors || data.doctors.length === 0) return [];
    let list = data.doctors.filter((d) => myPincodes.has(d.pincode));
    if (list.length === 0 && exec) {
      list = data.doctors.filter((d) => {
        const docCity = (d.city || "").toLowerCase().trim();
        const execCity = (exec.city || "").toLowerCase().trim();
        const execRegion = (exec.region || "").toLowerCase().trim();
        const isCityMatch = execCity && (docCity === execCity || (docCity.includes("bang") && execCity.includes("bang")));
        const isRegionMatch = execRegion && (docCity.includes(execRegion) || (d.name || "").toLowerCase().includes(execRegion));
        return isCityMatch || isRegionMatch;
      });
    }
    if (list.length === 0) {
      list = data.doctors;
    }
    return list;
  }, [data.doctors, myPincodes, exec]);

  const pincodeList = useMemo(
    () => [...new Set(myDoctors.map((d) => d.pincode).filter(Boolean))].sort(),
    [myDoctors]
  );

  const activeCount = myDoctors.filter(
    (d) => d.is_active === "Yes" || d.is_active === true
  ).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return myDoctors.filter((d) => {
      const matchSearch =
        !term ||
        d.name?.toLowerCase().includes(term) ||
        d.qualification?.toLowerCase().includes(term) ||
        d.specializations?.toLowerCase().includes(term) ||
        String(d.experience_years ?? "").includes(term) ||
        d.phone?.toLowerCase().includes(term) ||
        d.city?.toLowerCase().includes(term) ||
        String(d.pincode ?? "").includes(term);
      const matchPin = filterPincode === "all" || String(d.pincode) === filterPincode;
      const isActive = d.is_active === "Yes" || d.is_active === true;
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && isActive) ||
        (filterStatus === "inactive" && !isActive);
      return matchSearch && matchPin && matchStatus;
    });
  }, [myDoctors, search, filterPincode, filterStatus]);

  return (
    <div className="doc-view-wrap">

      {/* ── PAGE TITLE — same pattern as Reports ── */}
      <div className="crm-page-title">
        <h2>Doctors in My Region</h2>
      </div>

      {/* ── STAT PILLS ── */}
      <div className="doc-stat-row">
        <div className="doc-stat-card">
          <div className="stat-icon orange">⊞</div>
          <div>
            <span>Pin Codes</span>
            <strong>{pincodeList.length || myPincodes.size}</strong>
            <small>Assigned coverage</small>
          </div>
        </div>
        <div className="doc-stat-card">
          <div className="stat-icon blue">₹</div>
          <div>
            <span>Total Doctors</span>
            <strong>{myDoctors.length}</strong>
            <small>In my Region</small>
          </div>
        </div>
        <div className="doc-stat-card">
          <div className="stat-icon green">✓</div>
          <div>
            <span>Active</span>
            <strong>{activeCount}</strong>
            <small>Available for visits</small>
          </div>
        </div>
        <div className="doc-stat-card">
          <div className="stat-icon red">○</div>
          <div>
            <span>Inactive</span>
            <strong>{myDoctors.length - activeCount}</strong>
            <small>Not currently active</small>
          </div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="panel doc-view-filters">
        <div className="rpt-search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <label>Search</label>
          <div className="rpt-search-input-wrap">
            <input
              type="text"
              placeholder="Name, qualification, specialization, experience, phone, city, pin code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="rpt-search-icon"><VscSearch /></span>
          </div>
        </div>
        <div className="rpt-field">
          <label>Pin Code</label>
          <select value={filterPincode} onChange={(e) => setFilterPincode(e.target.value)}>
            <option value="all">All Pin Codes</option>
            {pincodeList.map((pc) => (
              <option key={pc} value={pc}>{pc}</option>
            ))}
          </select>
        </div>
        <div className="rpt-field">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* ── TABLE ── */}
      {data.loading ? (
        <div className="panel rpt-empty-state">Loading doctors…</div>
      ) : myDoctors.length === 0 ? (
        <div className="panel rpt-empty-state">No doctors found for this executive's region.</div>
      ) : filtered.length === 0 ? (
        <div className="panel rpt-empty-state">No doctors match your search.</div>
      ) : (
        <div className="panel table-panel doc-table-panel">
          <table>
            <thead>
              <tr>
                <th>Sno</th>
                <th>Doctor Name</th>
                <th>Qualification</th>
                <th>Specialization</th>
                <th>Experience</th>
                <th>Phone</th>
                <th>City</th>
                <th>Pin Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, i) => {
                const isActive = doc.is_active === "Yes" || doc.is_active === true;
                return (
                  <tr key={doc.id}>
                    <td className="doc-row-num">{i + 1}</td>
                    <td>
                      <div>
                        <span className="doc-name-text">{doc.name || "—"}</span>
                      </div>
                    </td>
                    <td className="doc-muted">{doc.qualification || "—"}</td>
                    <td>
                      {doc.specializations
                        ? doc.specializations.split(",").map((s, si) => (
                          <span key={si} className="rpt-doc-tag" style={{ marginRight: 3, marginBottom: 2, display: "inline-block" }}>
                            {s.trim()}
                          </span>
                        ))
                        : <span className="doc-muted">—</span>
                      }
                    </td>
                    <td className="doc-muted">
                      {doc.experience_years != null ? `${doc.experience_years} yrs` : "—"}
                    </td>
                    <td className="doc-muted">{doc.phone || "—"}</td>
                    <td className="doc-muted">{doc.city || "—"}</td>
                    <td><span className="doc-pincode-badge">{doc.pincode || "—"}</span></td>
                    <td>
                      <span className={"doc-status-badge" + (isActive ? " active" : " inactive")}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PLAN TARGET PANEL
   Shown on both Executive and Team dashboards whenever a
   monthly plan exists for the current period.
───────────────────────────────────────────────────────── */
function PlanTargetPanel({ planStats, monthLabel, onGoToPlan }) {
  const label = monthLabel || PLAN_MONTH_LABEL;
  if (!planStats || !planStats.has_plan) {
    return (
      <div className="panel pln-target-panel pln-target-empty-card">
        <div className="pln-target-header">
          <div>
            <h2 className="pln-target-title">
              Monthly Visit Target — {label}
            </h2>
            <p className="pln-hint">Individual visit target</p>
          </div>
          {onGoToPlan && (
            <button className="rpt-btn-primary pln-target-btn" onClick={onGoToPlan}>
              Create Plan →
            </button>
          )}
        </div>
        <div className="pln-empty-state" style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
          <p className="pln-hint" style={{ margin: "0 0 .75rem" }}>No monthly plan created yet for this month.</p>
          {onGoToPlan && (
            <button className="rpt-btn-outline" onClick={onGoToPlan}>
              Go to Plan Section
            </button>
          )}
        </div>
      </div>
    );
  }

  const {
    total_doctors = 0,
    completed = 0,
    pending = 0,
    planned_visits = 0,
    daily_target = 0,
    working_days = 0,
    completion_pct = 0,
    plan_status = "—",
  } = planStats;

  const statusCls = {
    Approved: "pln-planstatus-approved",
    Submitted: "pln-planstatus-submitted",
    Draft: "pln-planstatus-draft",
    Rejected: "pln-planstatus-rejected",
    "In Progress": "pln-planstatus-in-progress",
    Completed: "pln-planstatus-completed",
  }[plan_status] ?? "pln-planstatus-draft";

  const barColor = completion_pct >= 80
    ? "var(--chart-1)"
    : completion_pct >= 50
      ? "oklch(70% .16 75)"
      : "var(--destructive)";

  return (
    <div className="panel pln-target-panel">
      {/* ── header row ── */}
      <div className="pln-target-header">
        <div>
          <h2 className="pln-target-title">
            Monthly Visit Target — {label}
          </h2>
          <p className="pln-hint">
            {daily_target} doctors/day · {working_days} working days
          </p>
        </div>
        <div className="pln-target-header-right">
          <span className={"pln-planstatus " + statusCls}>{plan_status}</span>
          {onGoToPlan && (
            <button className="rpt-btn-outline pln-target-btn" onClick={onGoToPlan}>
              View Plan
            </button>
          )}
        </div>
      </div>

      {/* ── stat pills ── */}
      <div className="pln-target-pills">
        <div className="pln-target-pill">
          <strong>{total_doctors}</strong>
          <span>Target</span>
        </div>
        <div className="pln-target-pill pln-target-pill-green">
          <strong>{completed}</strong>
          <span>Completed</span>
        </div>
        <div className="pln-target-pill pln-target-pill-orange">
          <strong>{pending}</strong>
          <span>Pending</span>
        </div>
        <div className="pln-target-pill">
          <strong>{planned_visits}</strong>
          <span>Scheduled</span>
        </div>
      </div>

      {/* ── progress bar ── */}
      <div className="pln-target-progress-row">
        <div className="pln-target-progress-track">
          <div
            className="pln-target-progress-fill"
            style={{ width: `${Math.min(100, completion_pct)}%`, background: barColor }}
          />
        </div>
        <span className="pln-target-pct">{completion_pct}%</span>
      </div>
      <p className="pln-hint" style={{ marginTop: 5 }}>
        <strong>{completed}</strong> of <strong>{total_doctors}</strong> doctors
        visited this month
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TEAM PLAN TARGET PANEL (Managers & Regional Managers)
   Shows aggregate visit target + per-employee breakdown
───────────────────────────────────────────────────────── */
function TeamPlanTargetPanel({ execsInScope, monthKey, monthLabel, onGoToPlan, onTeamStatsLoaded }) {
  const [teamPlans, setTeamPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeMonth = monthKey || PLAN_MONTH_KEY;
  const activeMonthLabel = monthLabel || formatMonthLabel(activeMonth);

  useEffect(() => {
    let cancelled = false;
    if (!execsInScope || execsInScope.length === 0) {
      setTimeout(() => {
        if (!cancelled) {
          setTeamPlans([]);
          setLoading(false);
        }
      }, 0);
      return;
    }
    setTimeout(() => { if (!cancelled) setLoading(true); }, 0);
    Promise.all(
      execsInScope.map(async (exec) => {
        try {
          const res = await fetch(`${API_BASE}/plan-stats/${exec.id}?month_key=${activeMonth}`);
          const stats = await res.json();
          return { exec, stats };
        } catch {
          return {
            exec,
            stats: {
              has_plan: false,
              total_doctors: 0,
              completed: 0,
              pending: 0,
              planned_visits: 0,
              completion_pct: 0,
              plan_status: null,
            },
          };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setTeamPlans(results);
        setLoading(false);
        if (onTeamStatsLoaded) {
          const tTarget = results.reduce((s, r) => s + (r.stats?.total_doctors || 0), 0);
          const tDone = results.reduce((s, r) => s + (r.stats?.completed || 0), 0);
          const hasAny = results.some((r) => r.stats?.has_plan);
          const pct = tTarget > 0 ? Math.round((tDone / tTarget) * 100) : 0;
          onTeamStatsLoaded({ totalTarget: tTarget, totalDone: tDone, hasAnyPlan: hasAny, pct });
        }
      }
    });
    return () => { cancelled = true; };
  }, [execsInScope, activeMonth]); // eslint-disable-line

  const totalTarget = teamPlans.reduce((sum, r) => sum + (r.stats?.total_doctors || 0), 0);
  const totalCompleted = teamPlans.reduce((sum, r) => sum + (r.stats?.completed || 0), 0);
  const totalPending = teamPlans.reduce((sum, r) => sum + (r.stats?.pending || 0), 0);
  const totalScheduled = teamPlans.reduce((sum, r) => sum + (r.stats?.planned_visits || 0), 0);
  const overallPct = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  const barColor = overallPct >= 80
    ? "var(--chart-1)"
    : overallPct >= 50
      ? "oklch(70% .16 75)"
      : "var(--destructive)";

  return (
    <div className="panel pln-target-panel">
      {/* ── header row ── */}
      <div className="pln-target-header">
        <div>
          <h2 className="pln-target-title">
            Team Visit Target — {activeMonthLabel}
          </h2>
          <p className="pln-hint">
            Overall team target across {execsInScope.length} executive{execsInScope.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="pln-target-header-right">
          {onGoToPlan && (
            <button className="rpt-btn-outline pln-target-btn" onClick={onGoToPlan}>
              View Plans
            </button>
          )}
        </div>
      </div>

      {/* ── stat pills ── */}
      <div className="pln-target-pills">
        <div className="pln-target-pill">
          <strong>{totalTarget}</strong>
          <span>Target</span>
        </div>
        <div className="pln-target-pill pln-target-pill-green">
          <strong>{totalCompleted}</strong>
          <span>Completed</span>
        </div>
        <div className="pln-target-pill pln-target-pill-orange">
          <strong>{totalPending}</strong>
          <span>Pending</span>
        </div>
        <div className="pln-target-pill">
          <strong>{totalScheduled}</strong>
          <span>Scheduled</span>
        </div>
      </div>

      {/* ── overall progress bar ── */}
      <div className="pln-target-progress-row">
        <div className="pln-target-progress-track">
          <div
            className="pln-target-progress-fill"
            style={{ width: `${Math.min(100, overallPct)}%`, background: barColor }}
          />
        </div>
        <span className="pln-target-pct">{overallPct}%</span>
      </div>
      <p className="pln-hint" style={{ marginTop: 5 }}>
        <strong>{totalCompleted}</strong> of <strong>{totalTarget}</strong> team visits completed
      </p>

      {/* ── Employee Breakdown list ── */}
      <div className="pln-team-exec-list">
        <div className="pln-team-list-header">
          <span>Employee / Territory</span>
          <span>Visits (% Done)</span>
          <span>Plan Status</span>
        </div>
        {loading ? (
          <p className="pln-hint" style={{ padding: ".5rem 0" }}>Loading team plan data…</p>
        ) : teamPlans.length === 0 ? (
          <p className="pln-hint" style={{ padding: ".5rem 0" }}>No executives in scope.</p>
        ) : (
          teamPlans.map(({ exec, stats }) => {
            const statusCls = {
              Approved: "pln-planstatus-approved",
              Submitted: "pln-planstatus-submitted",
              Draft: "pln-planstatus-draft",
              Rejected: "pln-planstatus-rejected",
              "In Progress": "pln-planstatus-in-progress",
              Completed: "pln-planstatus-completed",
            }[stats.plan_status] ?? "pln-planstatus-draft";

            return (
              <div key={exec.id} className="pln-team-exec-row">
                <div className="pln-team-exec-info">
                  <div className="person-avatar">{exec.name?.charAt(0) || "?"}</div>
                  <div>
                    <strong>{exec.name}</strong>
                    <small>{exec.region || exec.city || "—"}</small>
                  </div>
                </div>
                <div className="pln-team-exec-stats">
                  <span>
                    <strong>{stats.completed}</strong> / {stats.total_doctors || 0} ({stats.completion_pct}%)
                  </span>
                  <div className="pln-team-exec-bar">
                    <div
                      className="pln-team-exec-fill"
                      style={{
                        width: `${Math.min(100, stats.completion_pct)}%`,
                        background: stats.completion_pct >= 80 ? "var(--chart-1)" : stats.completion_pct >= 50 ? "oklch(70% .16 75)" : "var(--primary)"
                      }}
                    />
                  </div>
                </div>
                <div className="pln-team-exec-badge-wrap">
                  {stats.has_plan ? (
                    <span className={"pln-planstatus " + statusCls}>
                      {stats.plan_status}
                    </span>
                  ) : (
                    <span className="doc-status-badge inactive">No Plan</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EXECUTIVE DASHBOARD
───────────────────────────────────────────────────────── */
function ExecutiveDashboard({ data, execId, planStats, monthLabel, onGoToPlan }) {
  const { executives, coverage, tasks, doctors, products } = data;
  const exec = executives.find((e) => e.id === execId) || executives[0];
  const myPincodes = new Set(coverage.filter((c) => c.executive_id === exec?.id).map((c) => c.pincode));
  const myTasks = tasks.filter((t) => !t.pincode || myPincodes.has(t.pincode));
  const done = myTasks.filter((t) => t.status === "done").length;
  const inProgress = myTasks.filter((t) => t.status === "in progress").length;
  const open = myTasks.length - done - inProgress;
  const donePct = myTasks.length > 0 ? Math.round((done / myTasks.length) * 100) : 0;
  const PRIORITIES = ["low", "medium", "high"];
  const totals = PRIORITIES.map((p) => myTasks.filter((t) => String(t.priority || "").toLowerCase() === p).length);
  const doneByPriority = PRIORITIES.map((p) => myTasks.filter((t) => String(t.priority || "").toLowerCase() === p && t.status === "done").length);
  const pincodeRows = [...myPincodes].map((pc) => ({
    pc,
    doctorCount: doctors.filter((d) => d.pincode === pc).length,
    productCount: products.filter((p) => p.pincode === pc).length,
  }));
  const maxScore = Math.max(1, ...pincodeRows.map((r) => r.doctorCount + r.productCount));
  const topPincodes = [...pincodeRows]
    .sort((a, b) => b.doctorCount + b.productCount - (a.doctorCount + a.productCount))
    .slice(0, 3)
    .map((r) => [r.pc, `${r.doctorCount} doctors · ${r.productCount} products`, `${Math.round(((r.doctorCount + r.productCount) / maxScore) * 100)}%`]);
  const statusRows = [
    ["Open", open, myTasks.length ? `${Math.round((open / myTasks.length) * 100)}%` : "0%"],
    ["In Progress", inProgress, myTasks.length ? `${Math.round((inProgress / myTasks.length) * 100)}%` : "0%"],
    ["Done", done, myTasks.length ? `${Math.round((done / myTasks.length) * 100)}%` : "0%"],
  ];
  const upcoming = myTasks
    .filter((t) => t.status !== "done" && t.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 4)
    .map((t) => [t.title, `pin ${t.pincode || "—"} · ${String(t.priority || "").toUpperCase()}`, t.due_date]);
  return (
    <>
      {/* ── Stat cards ── */}
      <div className="stats">
        <Stat icon="◎" title="My Tasks" value={myTasks.length} text={`${open} open`} type="blue" />
        <Stat icon="✓" title="Tasks Done" value={done} text={`${donePct}% complete`} type="green" />
        {planStats?.has_plan ? (
          <Stat
            icon="🗓"
            title="Plan Target"
            value={`${planStats.completion_pct ?? 0}%`}
            text={`${planStats.completed ?? 0} / ${planStats.total_doctors ?? 0} visits`}
            type="orange"
          />
        ) : (
          <Stat icon="♙" title="Pin Codes Covered" value={myPincodes.size} text="Assigned coverage" type="orange" />
        )}
        <Stat icon="⚕" title="Doctors In Area" value={pincodeRows.reduce((s, r) => s + r.doctorCount, 0)} text="Across my pin codes" type="red" />
      </div>

      {/* ── Top Grid: Tasks by Priority side-by-side with Plan Target Panel ── */}
      <div className="two-columns">
        <Chart title="My Tasks by Priority" categories={["Low", "Medium", "High"]} targets={totals} achieved={doneByPriority} />
        <PlanTargetPanel planStats={planStats} monthLabel={monthLabel} onGoToPlan={onGoToPlan} />
      </div>

      {/* ── Second Grid: Achievement Overview & Task Status ── */}
      <div className="two-columns">
        <Achievement percentage={`${donePct}%`} achieved={done} progress={inProgress} pending={open} />
        <StatusList title="My Task Status" rows={statusRows} />
      </div>

      {/* ── Third Grid: Top Pin Codes & Upcoming Tasks ── */}
      <div className="two-columns">
        <Performers title="Top Pin Codes in My Area" people={topPincodes} />
        <UpcomingList title="Upcoming Tasks" rows={upcoming} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   TEAM DASHBOARD (Managers & Regional Managers)
───────────────────────────────────────────────────────── */
function TeamDashboard({ data, region, scopeLabel, monthKey, monthLabel, onGoToPlan }) {
  const { executives, coverage, tasks, doctors } = data;
  const execsInScope = region ? executives.filter((e) => e.region === region) : executives;
  const [teamStatsSummary, setTeamStatsSummary] = useState(null);

  const execStats = execsInScope.map((exec) => {
    const pincodes = new Set(coverage.filter((c) => c.executive_id === exec.id).map((c) => c.pincode));
    const myTasks = tasks.filter((t) => t.pincode && pincodes.has(t.pincode));
    const done = myTasks.filter((t) => t.status === "done").length;
    const pct = myTasks.length > 0 ? Math.round((done / myTasks.length) * 100) : 0;
    return { exec, pincodes, taskCount: myTasks.length, done, pct };
  });
  const scopePincodes = [...new Set(coverage.filter((c) => execsInScope.some((e) => e.id === c.executive_id)).map((c) => c.pincode))];
  const scopeTasks = tasks.filter((t) => !t.pincode || scopePincodes.includes(t.pincode));
  const totalDone = scopeTasks.filter((t) => t.status === "done").length;
  const totalOpen = scopeTasks.length - totalDone;
  const overallPct = scopeTasks.length > 0 ? Math.round((totalDone / scopeTasks.length) * 100) : 0;
  const scopeDoctors = doctors.filter((d) => scopePincodes.includes(d.pincode)).length;
  const tableRows = execStats.slice(0, 6).map((r) => [r.exec.name, r.taskCount, r.done, `${r.pct}%`]);
  const categories = execStats.slice(0, 6).map((r) => r.exec.name);
  const targets = execStats.slice(0, 6).map((r) => r.taskCount);
  const achieved = execStats.slice(0, 6).map((r) => r.done);

  return (
    <>
      <div className="stats">
        <Stat icon="♙" title="My Executives" value={execsInScope.length} text={scopeLabel} type="blue" />
        <Stat icon="◎" title="Total Tasks" value={scopeTasks.length} text="This period" type="green" />
        {teamStatsSummary?.hasAnyPlan ? (
          <Stat
            icon="🗓"
            title="Team Plan Completion"
            value={`${teamStatsSummary.pct}%`}
            text={`${teamStatsSummary.totalDone} / ${teamStatsSummary.totalTarget} visits`}
            type="orange"
          />
        ) : (
          <Stat icon="▣" title="Pin Codes" value={scopePincodes.length} text="Covered" type="orange" />
        )}
        <Stat icon="₹" title="Task Completion" value={`${overallPct}%`} text={`${scopeDoctors} doctors in scope`} type="red" />
      </div>

      {/* ── Top Grid: Team Target vs Achievement side-by-side with Team Plan Target Panel ── */}
      <div className="two-columns">
        <Chart title="Team Target vs Achievement" categories={categories.length ? categories : ["—"]} targets={targets.length ? targets : [0]} achieved={achieved.length ? achieved : [0]} />
        <TeamPlanTargetPanel execsInScope={execsInScope} monthKey={monthKey} monthLabel={monthLabel} onGoToPlan={onGoToPlan} onTeamStatsLoaded={setTeamStatsSummary} />
      </div>

      <div className="two-columns">
        <Achievement percentage={`${overallPct}%`} achieved={totalDone} progress={0} pending={totalOpen} />
        <DashTable title="Executive Performance" headers={["Executive", "Tasks", "Done", "%"]} rows={tableRows} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   SHELL
───────────────────────────────────────────────────────── */
const ROLES = {
  EXECUTIVE: "executive",
  MANAGER: "manager",
  REGIONAL: "regional",
};

const ROLE_TITLES = {
  executive: "Sales Executive",
  manager: "Sales Manager",
  regional: "Regional Manager",
};

const SECTION_TITLES = {
  dashboard: "Dashboard",
  doctors: "Doctors",
  plan: "Plan",
  approvals: "Plan Approvals",
  reports: "Reports",
};

export default function SalesCrm({ role, onSwitchRole, onExit }) {
  const data = useSalesData();
  const [execId, setExecId] = useState(null);
  const [managerId, setManagerId] = useState(null);
  const [regionalId, setRegionalId] = useState(null);
  const [region, setRegion] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    if (!execId && data.executives.length) {
      const t = setTimeout(() => setExecId(data.executives[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [data.executives, execId]);

  useEffect(() => {
    if (!managerId && data.salesManagers.length) {
      const t = setTimeout(() => setManagerId(data.salesManagers[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [data.salesManagers, managerId]);

  useEffect(() => {
    if (!regionalId && data.regionalManagers.length) {
      const t = setTimeout(() => setRegionalId(data.regionalManagers[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [data.regionalManagers, regionalId]);

  useEffect(() => {
    let t;
    if (role !== ROLES.EXECUTIVE && activeSection === "plan") {
      t = setTimeout(() => setActiveSection("approvals"), 0);
    } else if (role === ROLES.EXECUTIVE && activeSection === "approvals") {
      t = setTimeout(() => setActiveSection("plan"), 0);
    }
    return () => clearTimeout(t);
  }, [role, activeSection]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const selectedMonthLabel = formatMonthLabel(selectedMonth);
  const monthOptions = useMemo(() => getAvailableMonthOptions(selectedMonth), [selectedMonth]);

  // ── Plan stats for the active executive (shown on the dashboard)
  // usePlanStats is a lightweight hook: just one GET /plan-stats/{id} call
  const { stats: planStats } = usePlanStats(execId, selectedMonth);

  const regions = useMemo(
    () => [...new Set(data.executives.map((e) => e.region).filter(Boolean))],
    [data.executives]
  );

  const currentTableKey = ROLE_TABLE_KEY[role];
  const currentRecord =
    role === ROLES.EXECUTIVE
      ? data.executives.find((e) => e.id === execId)
      : role === ROLES.MANAGER
        ? data.salesManagers.find((m) => m.id === managerId)
        : data.regionalManagers.find((r) => r.id === regionalId);

  function initialsOf(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  }

  function handleSwitchRole(newRole) {
    setActiveSection("dashboard");
    onSwitchRole(newRole);
  }

  const pageTitle = `${ROLE_TITLES[role]} — ${SECTION_TITLES[activeSection] ?? "Dashboard"}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><img src={logo} alt="Zenve Zippy" /></div>
          <div>
            <div className="brand-name">Zenve Zippy CRM</div>
            <div className="brand-sub">Sales CRM</div>
          </div>
        </div>

        <nav>
          <button
            className={"nav-item" + (activeSection === "dashboard" ? " active" : "")}
            onClick={() => setActiveSection("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={"nav-item" + (activeSection === "doctors" ? " active" : "")}
            onClick={() => setActiveSection("doctors")}
          >
            Doctors
          </button>
          {role === ROLES.EXECUTIVE && (
            <button
              className={"nav-item" + (activeSection === "plan" ? " active" : "")}
              onClick={() => setActiveSection("plan")}
            >
              Plan
            </button>
          )}
          {(role === ROLES.MANAGER || role === ROLES.REGIONAL) && (
            <button
              className={"nav-item" + (activeSection === "approvals" ? " active" : "")}
              onClick={() => setActiveSection("approvals")}
            >
              Approvals
            </button>
          )}
          <button
            className={"nav-item" + (activeSection === "reports" ? " active" : "")}
            onClick={() => setActiveSection("reports")}
          >
            Reports
          </button>

          <div className="nav-heading">SALES CRM</div>
          <button className={"nav-item" + (role === ROLES.REGIONAL ? " active" : "")} onClick={() => handleSwitchRole(ROLES.REGIONAL)}>
            Regional Managers
          </button>
          <button className={"nav-item" + (role === ROLES.MANAGER ? " active" : "")} onClick={() => handleSwitchRole(ROLES.MANAGER)}>
            Sales Managers
          </button>
          <button className={"nav-item" + (role === ROLES.EXECUTIVE ? " active" : "")} onClick={() => handleSwitchRole(ROLES.EXECUTIVE)}>
            Sales Executives
          </button>
          <button className="nav-item" onClick={onExit}>Admin CRM</button>
        </nav>
      </aside>

      <main className="main">
        <header className="header">
          <div className="title-section">
            <div>
              <h1>{pageTitle}</h1>
              <p>Track Performance • Manage Leads • Achieve Targets</p>
            </div>
          </div>

          <div className="header-right">
            <div className="role-switch">
              <label>View As</label>
              <select value={role} onChange={(e) => handleSwitchRole(e.target.value)}>
                <option value={ROLES.REGIONAL}>Regional Manager</option>
                <option value={ROLES.MANAGER}>Sales Manager</option>
                <option value={ROLES.EXECUTIVE}>Sales Executive</option>
              </select>
            </div>

            {role === ROLES.EXECUTIVE && data.executives.length > 0 && (
              <div className="role-switch">
                <label>Executive</label>
                <select value={execId ?? ""} onChange={(e) => setExecId(Number(e.target.value))}>
                  {data.executives.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {role === ROLES.MANAGER && data.salesManagers.length > 0 && (
              <div className="role-switch">
                <label>Manager</label>
                <select value={managerId ?? ""} onChange={(e) => setManagerId(Number(e.target.value))}>
                  {data.salesManagers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {role === ROLES.REGIONAL && data.regionalManagers.length > 0 && (
              <div className="role-switch">
                <label>Regional Manager</label>
                <select value={regionalId ?? ""} onChange={(e) => setRegionalId(Number(e.target.value))}>
                  {data.regionalManagers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(role === ROLES.MANAGER || role === ROLES.REGIONAL) && (
              <div className="role-switch">
                <label>Region filter</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">All</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="role-switch">
              <label>Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              className="profile-avatar-btn"
              title={currentRecord ? `${currentRecord.name} — view profile` : "No profile selected"}
              onClick={() => currentRecord && setProfileOpen(true)}
              disabled={!currentRecord}
            >
              {initialsOf(currentRecord?.name)}
            </button>
          </div>
        </header>

        <section className="content">
          {activeSection === "dashboard" && (
            <>
              {data.loading && <p style={{ color: "#7f8b98" }}>Loading dashboard…</p>}
              {data.error && <div className="dash-error">{data.error}</div>}
              {!data.loading && !data.error && role === ROLES.EXECUTIVE && (
                <ExecutiveDashboard
                  data={data}
                  execId={execId}
                  planStats={planStats}
                  monthLabel={selectedMonthLabel}
                  onGoToPlan={() => setActiveSection("plan")}
                />
              )}
              {!data.loading && !data.error && role === ROLES.MANAGER && (
                <TeamDashboard
                  data={data}
                  region={region || null}
                  scopeLabel="Active team members"
                  monthKey={selectedMonth}
                  monthLabel={selectedMonthLabel}
                  onGoToPlan={() => setActiveSection("approvals")}
                />
              )}
              {!data.loading && !data.error && role === ROLES.REGIONAL && (
                <TeamDashboard
                  data={data}
                  region={region || null}
                  scopeLabel="Across all regions"
                  monthKey={selectedMonth}
                  monthLabel={selectedMonthLabel}
                  onGoToPlan={() => setActiveSection("approvals")}
                />
              )}
            </>
          )}

          {activeSection === "reports" && (
            <ReportsView
              data={data}
              execId={execId}
              role={role}
              managerId={managerId}
              regionalId={regionalId}
              currentRecord={currentRecord}
            />
          )}

          {activeSection === "doctors" && (
            <DoctorsView data={data} execId={execId} />
          )}

          {(activeSection === "plan" || activeSection === "approvals") && (
            <PlanView
              data={data}
              execId={execId}
              role={role}
              monthKey={selectedMonth}
              onMonthChange={setSelectedMonth}
              initialTab={activeSection === "approvals" ? "approvals" : "overview"}
              regionFilter={region}
              onTabChange={(newTab) => {
                if (newTab === "approvals" && activeSection !== "approvals") {
                  setActiveSection("approvals");
                } else if (newTab !== "approvals" && activeSection === "approvals") {
                  if (role === ROLES.EXECUTIVE) {
                    setActiveSection("plan");
                  }
                }
              }}
              managerName={
                role === ROLES.REGIONAL
                  ? `${currentRecord?.name || data.regionalManagers?.find((r) => r.id === regionalId)?.name || "Regional Manager"} (Regional Manager)`
                  : role === ROLES.MANAGER
                    ? `${currentRecord?.name || data.salesManagers?.find((m) => m.id === managerId)?.name || "Sales Manager"} (Sales Manager)`
                    : "Manager"
              }
            />
          )}
        </section>
      </main>

      {profileOpen && currentRecord && (
        <ProfileModal
          tableKey={currentTableKey}
          record={currentRecord}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
