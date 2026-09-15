import { API_BASE } from "../api.js";

const CACHE_KEY_SUBMISSIONS = "zzc_executive_submissions_v1";

function loadSubmissionsCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_SUBMISSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubmissionsCache(list) {
  try {
    localStorage.setItem(CACHE_KEY_SUBMISSIONS, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function fetchSubmissionReports({
  executiveId,
  forRole,
  managerId,
  regionalManagerId,
  reportDate,
} = {}) {
  const params = new URLSearchParams();
  if (executiveId) params.append("executive_id", executiveId);
  if (forRole) params.append("for_role", forRole);
  if (managerId) params.append("manager_id", managerId);
  if (regionalManagerId) params.append("regional_manager_id", regionalManagerId);
  if (reportDate) params.append("report_date", reportDate);

  const qs = params.toString() ? `?${params.toString()}` : "";
  try {
    const res = await fetch(`${API_BASE}/executive-submission-reports${qs}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Cache locally for offline/resilience
        saveSubmissionsCache(data);
        return data;
      }
    }
  } catch (err) {
    console.warn("fetchSubmissionReports network fallback:", err);
  }

  // Fallback to cache if network fails
  const cached = loadSubmissionsCache();
  return cached.filter((r) => {
    if (executiveId && r.executive_id !== executiveId) return false;
    if (forRole === "manager" && r.recipient_type !== "manager" && r.recipient_type !== "both") return false;
    if (forRole === "regional" && r.recipient_type !== "regional" && r.recipient_type !== "both") return false;
    if (reportDate && r.report_date !== reportDate) return false;
    return true;
  });
}

export async function createSubmissionReport(payload) {
  let saved = null;
  try {
    const res = await fetch(`${API_BASE}/executive-submission-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      saved = await res.json();
    }
  } catch (err) {
    console.warn("createSubmissionReport network error:", err);
  }

  if (!saved) {
    saved = {
      ...payload,
      id: Date.now(),
      status: payload.status || "Submitted",
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  const existing = loadSubmissionsCache();
  const next = [saved, ...existing.filter((item) => item.id !== saved.id)];
  saveSubmissionsCache(next);

  return saved;
}

export async function updateSubmissionReport(reportId, payload) {
  let updated = null;
  try {
    const res = await fetch(`${API_BASE}/executive-submission-reports/${reportId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      updated = await res.json();
    }
  } catch (err) {
    console.warn("updateSubmissionReport network error:", err);
  }

  const existing = loadSubmissionsCache();
  const next = existing.map((r) => (r.id === reportId ? { ...r, ...payload, ...(updated || {}) } : r));
  saveSubmissionsCache(next);

  return updated || { id: reportId, ...payload };
}

export async function deleteSubmissionReport(reportId) {
  let success = false;
  try {
    const res = await fetch(`${API_BASE}/executive-submission-reports/${reportId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      success = true;
    }
  } catch (err) {
    console.warn("deleteSubmissionReport network error:", err);
  }

  const existing = loadSubmissionsCache();
  const next = existing.filter((r) => String(r.id) !== String(reportId));
  saveSubmissionsCache(next);

  return success;
}

