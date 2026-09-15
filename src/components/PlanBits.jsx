import { formatDateLong, formatDateShort } from "./planData.js";

export function StatusBadge({ status }) {
  const cls = "pln-status pln-status-" + status.toLowerCase().replace(/\s+/g, "-");
  return <span className={cls}>{status}</span>;
}

export function PriorityBadge({ priority }) {
  const cls = "pln-priority pln-priority-" + (priority || "medium").toLowerCase();
  return <span className={cls}>{priority || "Medium"}</span>;
}

export function PlanStatusBadge({ status }) {
  const cls = "pln-planstatus pln-planstatus-" + status.toLowerCase().replace(/\s+/g, "-");
  return <span className={cls}>{status}</span>;
}

export function ProgressBar({ pct, label }) {
  return (
    <div className="pln-progress-wrap">
      {label && <div className="pln-progress-label">{label}</div>}
      <div className="pln-progress-track">
        <div className="pln-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div className="pln-progress-pct">{pct}%</div>
    </div>
  );
}

export function SummaryCards({ stats }) {
  const cards = [
    { label: "Assigned Doctors", value: stats.totalAssigned, icon: "⚕", type: "blue" },
    { label: "Planned Visits", value: stats.planned, icon: "🗓", type: "orange" },
    { label: "Completed", value: stats.completed, icon: "✓", type: "green" },
    { label: "Pending", value: stats.pending, icon: "○", type: "red" },
    { label: "Completion", value: `${stats.completionPct}%`, icon: "%", type: "blue" },
  ];
  return (
    <div className="stats pln-summary-grid">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className={`stat-icon ${c.type}`}>{c.icon}</div>
          <div>
            <span>{c.label}</span>
            <strong>{c.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DoctorMiniCard({ doctor }) {
  if (!doctor) return <span className="doc-muted">Unknown doctor</span>;
  return (
    <div className="doc-name-cell">
      <div className="doc-avatar">{doctor.name?.charAt(4)?.toUpperCase() ?? "D"}</div>
      <div>
        <span className="doc-name-text">{doctor.name}</span>
        <div className="doc-muted" style={{ fontSize: ".7rem" }}>{doctor.specialization}</div>
      </div>
    </div>
  );
}

export function TaskDateLabel({ iso }) {
  return <span title={formatDateLong(iso)}>{formatDateShort(iso)}</span>;
}
