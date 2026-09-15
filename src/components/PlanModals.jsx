import { useState } from "react";
import {
  PLAN_MONTH_LABEL,
  RESCHEDULE_REASONS,
  VISIT_TIME_OPTIONS,
  formatDateLong,
  getPlanToday,
  getMonthBounds,
  formatMonthLabel,
  getCurrentMonthKey,
} from "./planData.js";
import { StatusBadge, PriorityBadge, DoctorMiniCard } from "./PlanBits.jsx";

/* ───────────────────────── CREATE MONTHLY PLAN ───────────────────────── */
export function CreatePlanModal({ totalAssigned, workingDaysCount, monthLabel, monthKey, onClose, onCreate }) {
  const [method, setMethod] = useState("auto");
  const dailyTarget = workingDaysCount > 0 ? Math.ceil(totalAssigned / workingDaysCount) : 0;
  const displayMonth = monthLabel || (monthKey ? formatMonthLabel(monthKey) : PLAN_MONTH_LABEL);

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal">
        <h2>Create Monthly Plan</h2>
        <div className="zzc-modal-form">
          <div className="zzc-field">
            <label>Month</label>
            <input value={displayMonth} disabled />
          </div>
          <div className="pln-two-col">
            <div className="zzc-field">
              <label>Total Assigned Doctors</label>
              <input value={totalAssigned} disabled />
            </div>
            <div className="zzc-field">
              <label>Working Days</label>
              <input value={workingDaysCount} disabled />
            </div>
          </div>
          <div className="zzc-field">
            <label>Daily Target (auto-calculated)</label>
            <input value={`${dailyTarget} doctors / day`} disabled />
          </div>
          <div className="zzc-field">
            <label>Planning Method</label>
            <div className="pln-radio-row">
              <label className="pln-radio">
                <input type="radio" checked={method === "manual"} onChange={() => setMethod("manual")} />
                Manual Planning
              </label>
              <label className="pln-radio">
                <input type="radio" checked={method === "auto"} onChange={() => setMethod("auto")} />
                Auto Generate Plan
              </label>
            </div>
            <p className="pln-hint">
              {method === "auto"
                ? "The system will distribute all assigned doctors evenly across working days. You can adjust individual dates afterwards."
                : "You'll schedule each doctor's visit date yourself from the Assigned Doctors tab."}
            </p>
          </div>
        </div>
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="zzc-btn zzc-btn-primary" onClick={() => { onCreate(method); onClose(); }}>
            {method === "auto" ? "Generate Plan" : "Create Draft Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── VISIT REPORT ───────────────────────── */
export function VisitReportModal({ doctor, task, existingReport, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({
    visitDate: existingReport?.visitDate || task.scheduledDate,
    visitTime: existingReport?.visitTime || task.visitTime || "10:00 AM",
    location: existingReport?.location || `${doctor?.hospital || ""}, ${doctor?.location || ""}`,
    purpose: existingReport?.purpose || "Product Detailing",
    productsDiscussed: existingReport?.productsDiscussed || "",
    notes: existingReport?.notes || "",
    doctorFeedback: existingReport?.doctorFeedback || "",
    workWith: existingReport?.workWith || "",
    nextFollowupDate: existingReport?.nextFollowupDate || "",
    nextAction: existingReport?.nextAction || "",
    remarks: existingReport?.remarks || "",
    followUpRequired: existingReport?.followUpRequired ?? true,
  }));

  function set(key, val) { setForm((p) => ({ ...p, [key]: val })); }

  function handleSubmit(e, asDraft) {
    e.preventDefault();
    onSubmit(form, asDraft);
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal rpt-call-modal">
        <div className="rpt-call-modal-header">
          <div>
            <h2>Visit Report — {doctor?.name}</h2>
            <p className="rpt-call-modal-sub">{doctor?.specialization} · {doctor?.hospital}, {doctor?.location}</p>
          </div>
          <button className="rpt-call-close" onClick={onClose} type="button">✕</button>
        </div>

        <form id="visitReportForm" className="rpt-call-form" onSubmit={(e) => handleSubmit(e, false)}>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Visit Date *</label>
              <input type="date" value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} required />
            </div>
            <div className="rpt-call-field">
              <label>Visit Time</label>
              <select value={form.visitTime} onChange={(e) => set("visitTime", e.target.value)}>
                {VISIT_TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Location</label>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Visit Purpose</label>
              <select value={form.purpose} onChange={(e) => set("purpose", e.target.value)} required>
                <option>Product Detailing</option>
                <option>Follow-up Visit</option>
                <option>New Product Launch</option>
                <option>Relationship Building</option>
                <option>Sample Distribution</option>
              </select>
            </div>
            <div className="rpt-call-field">
              <label>Products Discussed</label>
              <input value={form.productsDiscussed} onChange={(e) => set("productsDiscussed", e.target.value)} placeholder="e.g. Nebicard 5mg, Losar-H" />
            </div>
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Discussion Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What was discussed during the visit?" />
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Doctor Feedback</label>
            <textarea rows={2} value={form.doctorFeedback} onChange={(e) => set("doctorFeedback", e.target.value)} placeholder="Doctor's response, objections, requests…" />
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Work With</label>
            <textarea rows={2} value={form.workWith} onChange={(e) => set("workWith", e.target.value)} placeholder="Notes on who you worked with…" />
          </div>
          <div className="rpt-call-row">
            <div className="rpt-call-field">
              <label>Next Follow-up Date</label>
              <input type="date" value={form.nextFollowupDate} onChange={(e) => set("nextFollowupDate", e.target.value)} />
            </div>
            <div className="rpt-call-field">
              <label>Next Action</label>
              <input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="e.g. Send literature" />
            </div>
          </div>
          <div className="rpt-call-field rpt-call-field-full">
            <label>Remarks</label>
            <input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Any additional remarks" />
          </div>
          <label className="pln-radio" style={{ marginTop: 2 }}>
            <input type="checkbox" checked={form.followUpRequired} onChange={(e) => set("followUpRequired", e.target.checked)} />
            Follow-up required
          </label>
        </form>

        <div className="rpt-call-modal-footer">
          <button type="button" className="rpt-btn-outline" onClick={(e) => handleSubmit(e, true)}>Save Draft</button>
          <button type="submit" form="visitReportForm" className="rpt-btn-primary rpt-btn-post-submit">✓ Submit Visit Report</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── RESCHEDULE ───────────────────────── */
export function RescheduleModal({ doctor, task, monthKey, onClose, onReschedule }) {
  const [date, setDate] = useState(task.scheduledDate);
  const [reason, setReason] = useState(RESCHEDULE_REASONS[0]);
  const bounds = getMonthBounds(monthKey || task.scheduledDate?.slice(0, 7) || getCurrentMonthKey());

  function handleSave(e) {
    e.preventDefault();
    onReschedule(date, reason);
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal">
        <h2>Reschedule Visit — {doctor?.name}</h2>
        <form id="rescheduleForm" className="zzc-modal-form" onSubmit={handleSave}>
          <div className="zzc-field">
            <label>New Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={bounds.min} max={bounds.max} required />
          </div>
          <div className="zzc-field">
            <label>Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} required>
              {RESCHEDULE_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </form>
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="rescheduleForm" className="zzc-btn zzc-btn-primary">Reschedule</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── MANUAL SCHEDULE (one doctor) ───────────────────────── */
export function ScheduleDoctorModal({ doctor, monthKey, onClose, onSchedule }) {
  const activeMonthKey = monthKey || getCurrentMonthKey();
  const bounds = getMonthBounds(activeMonthKey);
  const [date, setDate] = useState(() => getPlanToday(activeMonthKey));
  const [time, setTime] = useState(VISIT_TIME_OPTIONS[0]);

  function handleSave(e) {
    e.preventDefault();
    onSchedule(date, time);
    onClose();
  }

  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal">
        <h2>Schedule Visit — {doctor?.name}</h2>
        <form id="scheduleDoctorForm" className="zzc-modal-form" onSubmit={handleSave}>
          <div className="zzc-field">
            <label>Visit Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={bounds.min} max={bounds.max} required />
          </div>
          <div className="zzc-field">
            <label>Visit Time</label>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {VISIT_TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </form>
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="scheduleDoctorForm" className="zzc-btn zzc-btn-primary">Add to Plan</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── APPROVAL REASON (reject / request changes) ───────────────────────── */
export function ApprovalReasonModal({ title, actionLabel, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal">
        <h2>{title}</h2>
        <form id="approvalReasonForm" className="zzc-modal-form" onSubmit={(e) => { e.preventDefault(); onConfirm(reason); onClose(); }}>
          <div className="zzc-field">
            <label>Comments *</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Explain what needs to change…" style={{
              width: "100%", border: "1px solid var(--border)", borderRadius: "calc(var(--radius) - 4px)",
              background: "var(--background)", padding: ".5rem .65rem", outline: "none", fontFamily: "inherit", fontSize: ".82rem",
            }} />
          </div>
        </form>
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="approvalReasonForm" className="zzc-btn zzc-btn-primary">{actionLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── DAY DETAIL ───────────────────────── */
export function DayDetailModal({ date, tasks, doctorMap, onClose, renderActions }) {
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const pending = tasks.length - completed;
  return (
    <div className="zzc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zzc-modal" style={{ maxWidth: 640 }}>
        <h2>{formatDateLong(date)}</h2>
        <p className="pln-hint" style={{ marginTop: -8, marginBottom: 12 }}>
          {tasks.length} doctor{tasks.length !== 1 ? "s" : ""} planned · {completed} completed · {pending} pending
        </p>
        {tasks.length === 0 ? (
          <div className="rpt-empty-state">No visits scheduled on this date.</div>
        ) : (
          <div className="pln-day-list">
            {tasks.map((t) => {
              const doctor = doctorMap.get(t.doctorId);
              return (
                <div className="pln-day-list-row" key={t.id}>
                  <DoctorMiniCard doctor={doctor} />
                  <div className="pln-day-list-meta">
                    <span className="doc-muted">{t.visitTime}</span>
                    <PriorityBadge priority={doctor?.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                  {renderActions && <div className="pln-day-list-actions">{renderActions(t, doctor)}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="zzc-modal-actions">
          <button type="button" className="zzc-btn zzc-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
