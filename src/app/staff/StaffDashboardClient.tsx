
"use client";

import { useEffect, useState } from "react";
import LogoutButton from "../../components/LogoutButton";

type StaffIssue = {
  assignment_id: number;
  assigned_at: string;
  assignment_notes: string | null;
  issue_id: number;
  title: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  created_at: string;
  category_name: string | null;
  department_name: string | null;
};

type Evidence = {
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  url: string;
};

export default function StaffDashboard() {
  const [issues, setIssues] = useState<StaffIssue[]>([]);
  const [evidenceByIssue, setEvidenceByIssue] = useState<
    Record<number, Evidence[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadIssues() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff/issues");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load assigned issues.");
      }

      const assignedIssues: StaffIssue[] = data.issues;
      setIssues(assignedIssues);

      // Load evidence for every assigned issue.
      setEvidenceLoading(true);

      const evidenceResults = await Promise.all(
        assignedIssues.map(async (issue) => {
          try {
            const evidenceResponse = await fetch(
              `/api/issues/${issue.issue_id}/evidence`
            );

            const evidenceData = await evidenceResponse.json();

            if (!evidenceResponse.ok || !evidenceData.success) {
              return {
                issueId: issue.issue_id,
                evidence: [],
              };
            }

            return {
              issueId: issue.issue_id,
              evidence: evidenceData.evidence as Evidence[],
            };
          } catch {
            return {
              issueId: issue.issue_id,
              evidence: [],
            };
          }
        })
      );

      const evidenceMap: Record<number, Evidence[]> = {};

      evidenceResults.forEach((result) => {
        evidenceMap[result.issueId] = result.evidence;
      });

      setEvidenceByIssue(evidenceMap);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load assigned issues."
      );
    } finally {
      setEvidenceLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssues();
  }, []);

  const inProgress = issues.filter(
    (issue) => issue.status === "in_progress"
  ).length;

  const resolved = issues.filter(
    (issue) => issue.status === "resolved"
  ).length;

  const assigned = issues.filter(
    (issue) => issue.status === "assigned"
  ).length;

  async function updateStatus(issue: StaffIssue) {
    const nextStatus =
      issue.status === "assigned" ? "in_progress" : "resolved";

    const remarks = window.prompt(
      `Enter remarks for marking issue #${issue.issue_id} as ${nextStatus.replace("_", " ")}:`
    );

    if (remarks === null) return;

    if (remarks.trim().length < 3) {
      setError("Please enter at least 3 characters for the remarks.");
      return;
    }

    setUpdatingId(issue.issue_id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/staff/issues/${issue.issue_id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
            remarks: remarks.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update issue status.");
      }

      setMessage(
        `Issue #${issue.issue_id} successfully updated to ${nextStatus.replace("_", " ")}.`
      );

      await loadIssues();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status update failed."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "resolved":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "assigned":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function priorityColor(priority: string) {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-green-700">
          CivicTrack Staff
        </h1>
        <LogoutButton />
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
              Staff Workspace
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              Staff Dashboard
            </h2>
            <p className="mt-2 text-slate-600">
              View and manage your assigned civic issues.
            </p>
          </div>

          <button
            onClick={loadIssues}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh Issues"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Assigned", value: issues.length },
            { label: "Awaiting Work", value: assigned },
            { label: "In Progress", value: inProgress },
            { label: "Resolved", value: resolved },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">My Assigned Issues</h3>
          <p className="mt-1 text-sm text-slate-500">
            Issues assigned to your staff account by the administrator.
          </p>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading assigned issues...
            </p>
          ) : issues.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              No issues have been assigned to you yet.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {issues.map((issue) => (
                <article
                  key={issue.assignment_id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-green-700">
                        Issue #{issue.issue_id}
                      </p>
                      <h4 className="mt-1 text-lg font-bold">
                        {issue.title}
                      </h4>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityColor(issue.priority)}`}
                      >
                        {issue.priority.toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(issue.status)}`}
                      >
                        {issue.status.replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    {issue.description}
                  </p>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <p>
                      <strong>Category:</strong>{" "}
                      {issue.category_name || "Not specified"}
                    </p>
                    <p>
                      <strong>Location:</strong>{" "}
                      {issue.location_text || "Not specified"}
                    </p>
                    <p>
                      <strong>Department:</strong>{" "}
                      {issue.department_name || "Not assigned"}
                    </p>
                    <p>
                      <strong>Assigned on:</strong>{" "}
                      {new Date(issue.assigned_at).toLocaleDateString()}
                    </p>
                  </div>

                  {issue.assignment_notes && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                      <strong>Admin instructions:</strong>{" "}
                      {issue.assignment_notes}
                    </div>
                  )}

                  {/* Evidence Images */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h5 className="font-semibold text-slate-800">
                      Evidence Images
                    </h5>

                    {evidenceLoading ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Loading evidence...
                      </p>
                    ) : evidenceByIssue[issue.issue_id]?.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-4">
                        {evidenceByIssue[issue.issue_id].map((evidence) => (
                          <div
                            key={evidence.fileId}
                            className="w-40 rounded-lg border border-slate-200 p-2"
                          >
                            <a
                              href={evidence.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={evidence.url}
                                alt={evidence.fileName}
                                className="h-28 w-full rounded-md object-cover"
                              />
                            </a>

                            <p className="mt-2 truncate text-xs font-semibold">
                              {evidence.fileName}
                            </p>

                            <p className="text-xs text-slate-500">
                              {formatFileSize(evidence.size)}
                            </p>

                            <a
                              href={evidence.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                            >
                              View full image
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No evidence images uploaded for this issue.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    {issue.status === "assigned" && (
                      <button
                        onClick={() => updateStatus(issue)}
                        disabled={updatingId === issue.issue_id}
                        className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        {updatingId === issue.issue_id
                          ? "Updating..."
                          : "Start Working"}
                      </button>
                    )}

                    {issue.status === "in_progress" && (
                      <button
                        onClick={() => updateStatus(issue)}
                        disabled={updatingId === issue.issue_id}
                        className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {updatingId === issue.issue_id
                          ? "Updating..."
                          : "Mark as Resolved"}
                      </button>
                    )}

                    {issue.status === "resolved" && (
                      <p className="font-semibold text-green-700">
                        ✓ This issue has been resolved.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
