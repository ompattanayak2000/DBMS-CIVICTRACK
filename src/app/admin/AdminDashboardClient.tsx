
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

type Issue = {
  issue_id: number;
  title: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  created_at: string;
  citizen_name: string;
  citizen_email: string;
  category_name: string;
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

type Staff = {
  user_id: number;
  full_name: string;
  email: string;
};

type Assignment = {
  assignment_id: number;
  issue_id: number;
  staff_user_id: number;
  assigned_by: number;
  assigned_at: string;
  notes: string | null;
  staff_name: string;
  staff_email: string;
  issue_title: string;
  issue_status: string;
};

type Feedback = {
  feedback_id: number;
  issue_id: number;
  citizen_id: number;
  rating: number;
  comments: string | null;
  created_at: string;
  issue_title: string;
  citizen_name: string;
  citizen_email: string;
};

type DashboardStats = {
  total_issues: number;
  pending_issues: number;
  in_progress_issues: number;
  resolved_issues: number;
  rejected_issues: number;
};

type DashboardResponse = {
  success: boolean;
  message: string;
  stats: DashboardStats;
  issues: Issue[];
};

const availableStatuses = [
  "reported",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
  "closed",
];

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  const [evidenceByIssue, setEvidenceByIssue] =
    useState<Record<number, Evidence[]>>({});

  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Feedback Management
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  // Staff Management form
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffError, setStaffError] = useState("");

  const [assignments, setAssignments] = useState<
    Record<number, Assignment>
  >({});

  const [selectedStaff, setSelectedStaff] = useState<
    Record<number, string>
  >({});

  const [assignmentNotes, setAssignmentNotes] = useState<
    Record<number, string>
  >({});

  const [assigningId, setAssigningId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<number, string>
  >({});

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Load dashboard data and evidence
  async function loadDashboard() {
    const response = await fetch("/api/admin/dashboard", {
      credentials: "same-origin",
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }

    const result: DashboardResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load dashboard.");
    }

    setStats(result.stats);
    setIssues(result.issues);

    // Fetch evidence metadata for every issue
    const evidenceResults = await Promise.all(
      result.issues.map(async (issue) => {
        try {
          const evidenceResponse = await fetch(
            `/api/issues/${issue.issue_id}/evidence`,
            { credentials: "same-origin" }
          );

          if (!evidenceResponse.ok) {
            return {
              issueId: issue.issue_id,
              evidence: [],
            };
          }

          const evidenceResult = await evidenceResponse.json();

          return {
            issueId: issue.issue_id,
            evidence: evidenceResult.success
              ? (evidenceResult.evidence as Evidence[])
              : [],
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

    evidenceResults.forEach((item) => {
      evidenceMap[item.issueId] = item.evidence;
    });

    setEvidenceByIssue(evidenceMap);
  }

  // Load all staff members
  async function loadStaff() {
    const response = await fetch("/api/admin/staff", {
      credentials: "same-origin",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load staff members.");
    }

    setStaffList(result.staff);
  }

  // Load all citizen feedback
  async function loadFeedback() {
    setFeedbackLoading(true);
    setFeedbackError("");

    try {
      const response = await fetch("/api/feedback", {
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        throw new Error("You are not authorized to view feedback.");
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load feedback.");
      }

      setFeedbackList(result.feedback as Feedback[]);
    } catch (err) {
      setFeedbackError(
        err instanceof Error ? err.message : "Unable to load feedback."
      );
    } finally {
      setFeedbackLoading(false);
    }
  }

  // Create a staff account through the admin-only API
  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingStaff(true);
    setStaffMessage("");
    setStaffError("");

    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          full_name: newStaffName.trim(),
          email: newStaffEmail.trim().toLowerCase(),
          password: newStaffPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to create staff account.");
      }

      setStaffMessage(
        result.message || "Staff account created successfully."
      );

      setNewStaffName("");
      setNewStaffEmail("");
      setNewStaffPassword("");

      await loadStaff();
    } catch (err) {
      setStaffError(
        err instanceof Error
          ? err.message
          : "Unable to create staff account."
      );
    } finally {
      setCreatingStaff(false);
    }
  }

  // Load existing assignments
  async function loadAssignments() {
    const response = await fetch("/api/admin/assignments", {
      credentials: "same-origin",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load assignments.");
    }

    const assignmentMap: Record<number, Assignment> = {};

    (result.assignments as Assignment[]).forEach((assignment) => {
      assignmentMap[assignment.issue_id] = assignment;
    });

    setAssignments(assignmentMap);
  }

  // Refresh dashboard information
  async function refreshDashboard() {
    await Promise.all([
      loadDashboard(),
      loadAssignments(),
    ]);
  }

  // Initialize dashboard
  useEffect(() => {
    async function initializeDashboard() {
      try {
        await Promise.all([
          loadDashboard(),
          loadStaff(),
          loadAssignments(),
          loadFeedback(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    }

    initializeDashboard();
  }, []);

  // Assign or reassign an issue
  async function assignIssue(issueId: number) {
    const staffUserId = selectedStaff[issueId];

    if (!staffUserId) {
      alert("Please select a staff member.");
      return;
    }

    const currentAssignment = assignments[issueId];

    if (
      currentAssignment &&
      Number(currentAssignment.staff_user_id) === Number(staffUserId)
    ) {
      alert("This issue is already assigned to the selected staff member.");
      return;
    }

    const notes = assignmentNotes[issueId] || "";

    setAssigningId(issueId);
    setError("");

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          issue_id: issueId,
          staff_user_id: Number(staffUserId),
          notes: notes.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to assign issue.");
      }

      alert(result.message || "Assignment saved successfully.");

      setSelectedStaff((previous) => {
        const updated = { ...previous };
        delete updated[issueId];
        return updated;
      });

      setAssignmentNotes((previous) => {
        const updated = { ...previous };
        delete updated[issueId];
        return updated;
      });

      await refreshDashboard();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to assign issue."
      );
    } finally {
      setAssigningId(null);
    }
  }

  // Update issue status
  async function updateIssueStatus(issueId: number) {
    const newStatus = selectedStatuses[issueId];

    if (!newStatus) {
      alert("Please select a status.");
      return;
    }

    const currentIssue = issues.find(
      (issue) => issue.issue_id === issueId
    );

    if (!currentIssue || currentIssue.status === newStatus) {
      alert("Please select a different status.");
      return;
    }

    const remarks = window.prompt(
      "Enter remarks for this status update:"
    );

    if (remarks === null) {
      return;
    }

    setUpdatingId(issueId);

    try {
      const response = await fetch(
        `/api/admin/issues/${issueId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            status: newStatus,
            remarks,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Status update failed."
        );
      }

      await refreshDashboard();

      setSelectedStatuses((previous) => {
        const updated = { ...previous };
        delete updated[issueId];
        return updated;
      });

      alert("Issue status updated successfully.");
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to update issue status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "resolved":
      case "closed":
        return "bg-green-100 text-green-800";

      case "rejected":
        return "bg-red-100 text-red-800";

      case "in_progress":
        return "bg-blue-100 text-blue-800";

      case "assigned":
        return "bg-purple-100 text-purple-800";

      case "verified":
        return "bg-yellow-100 text-yellow-800";

      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function formatStatus(status: string) {
    return status.replaceAll("_", " ");
  }

  function formatFileSize(size: number) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  const averageRating =
    feedbackList.length > 0
      ? feedbackList.reduce((sum, item) => sum + item.rating, 0) /
        feedbackList.length
      : 0;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      {/* Navigation */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-4">
        <Link
          href="/"
          className="text-2xl font-bold text-green-700"
        >
          CivicTrack
        </Link>

        <div className="flex items-center gap-5">
          <span className="font-semibold text-gray-700">
            Admin Dashboard
          </span>

          <LogoutButton />
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-10">

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-gray-600">
            Monitor civic issues reported by citizens and manage their progress.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <p className="mt-10 text-gray-600">
            Loading admin dashboard...
          </p>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Dashboard */}
        {!loading && !error && stats && (
          <>

            {/* Statistics Cards */}
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Total Issues
                </p>
                <h2 className="mt-2 text-3xl font-bold">
                  {stats.total_issues}
                </h2>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Pending
                </p>
                <h2 className="mt-2 text-3xl font-bold text-yellow-600">
                  {stats.pending_issues}
                </h2>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  In Progress
                </p>
                <h2 className="mt-2 text-3xl font-bold text-blue-600">
                  {stats.in_progress_issues}
                </h2>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Resolved
                </p>
                <h2 className="mt-2 text-3xl font-bold text-green-600">
                  {stats.resolved_issues}
                </h2>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Rejected
                </p>
                <h2 className="mt-2 text-3xl font-bold text-red-600">
                  {stats.rejected_issues}
                </h2>
              </div>

            </div>

            {/* Issues Table */}
            <div className="mt-10 overflow-hidden rounded-xl border bg-white shadow-sm">

              <div className="border-b px-6 py-5">
                <h2 className="text-xl font-bold">
                  Reported Civic Issues
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  View and manage issues submitted by registered citizens.
                </p>
              </div>

              {issues.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No civic issues have been reported yet.
                </div>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full text-left text-sm">

                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-5 py-4">Issue</th>
                        <th className="px-5 py-4">Citizen</th>
                        <th className="px-5 py-4">Category</th>
                        <th className="px-5 py-4">Location</th>
                        <th className="px-5 py-4">Priority</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Reported On</th>
                        <th className="px-5 py-4">Evidence</th>
                        <th className="px-5 py-4">Staff Assignment</th>
                        <th className="px-5 py-4">Update Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">

                      {issues.map((issue) => {
                        const evidence =
                          evidenceByIssue[issue.issue_id] ?? [];

                        const assignment =
                          assignments[issue.issue_id];

                        const canAssign = [
                          "reported",
                          "verified",
                          "assigned",
                          "in_progress",
                        ].includes(issue.status);

                        return (
                          <tr
                            key={issue.issue_id}
                            className="hover:bg-gray-50"
                          >

                            <td className="px-5 py-4">
                              <p className="font-semibold">
                                #{issue.issue_id} - {issue.title}
                              </p>

                              <p className="mt-1 max-w-xs text-xs text-gray-500">
                                {issue.description}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-medium">
                                {issue.citizen_name}
                              </p>

                              <p className="text-xs text-gray-500">
                                {issue.citizen_email}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              {issue.category_name}
                            </td>

                            <td className="px-5 py-4">
                              {issue.location_text}
                            </td>

                            <td className="px-5 py-4 capitalize">
                              {issue.priority}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusStyle(issue.status)}`}
                              >
                                {formatStatus(issue.status)}
                              </span>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                              {new Date(
                                issue.created_at
                              ).toLocaleDateString()}
                            </td>

                            {/* Evidence Images */}
                            <td className="px-5 py-4">
                              {evidence.length === 0 ? (
                                <span className="text-xs text-gray-400">
                                  No evidence
                                </span>
                              ) : (
                                <div className="flex min-w-32 flex-wrap gap-2">
                                  {evidence.map((file) => (
                                    <a
                                      key={file.fileId}
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={file.fileName}
                                      className="block"
                                    >
                                      <img
                                        src={file.url}
                                        alt={file.fileName}
                                        loading="lazy"
                                        className="h-16 w-16 rounded-lg border object-cover hover:opacity-80"
                                      />

                                      <span className="block max-w-20 truncate text-xs text-gray-600">
                                        {file.fileName}
                                      </span>

                                      <span className="block text-xs text-gray-400">
                                        {formatFileSize(file.size)}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Staff Assignment and Reassignment */}
                            <td className="min-w-64 px-5 py-4">
                              {canAssign ? (
                                <div className="flex min-w-56 flex-col gap-2">

                                  {assignment && (
                                    <div className="rounded-lg bg-purple-50 p-3 text-xs">
                                      <p className="font-semibold text-purple-800">
                                        Currently Assigned
                                      </p>

                                      <p className="mt-1 font-medium">
                                        {assignment.staff_name}
                                      </p>

                                      <p className="text-gray-600">
                                        {assignment.staff_email}
                                      </p>

                                      {assignment.notes && (
                                        <p className="mt-2 text-gray-600">
                                          Instructions: {assignment.notes}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  <label className="text-xs font-semibold text-gray-600">
                                    {assignment
                                      ? "Select New Staff Member"
                                      : "Select Staff Member"}
                                  </label>

                                  <select
                                    value={selectedStaff[issue.issue_id] || ""}
                                    onChange={(event) =>
                                      setSelectedStaff((previous) => ({
                                        ...previous,
                                        [issue.issue_id]: event.target.value,
                                      }))
                                    }
                                    className="rounded-lg border border-gray-300 px-3 py-2"
                                    disabled={assigningId === issue.issue_id}
                                  >
                                    <option value="">
                                      Select Staff
                                    </option>

                                    {staffList.map((staff) => (
                                      <option
                                        key={staff.user_id}
                                        value={staff.user_id}
                                      >
                                        {staff.full_name} ({staff.email})
                                      </option>
                                    ))}
                                  </select>

                                  <textarea
                                    value={
                                      assignmentNotes[issue.issue_id] ??
                                      assignment?.notes ??
                                      ""
                                    }
                                    onChange={(event) =>
                                      setAssignmentNotes((previous) => ({
                                        ...previous,
                                        [issue.issue_id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Assignment instructions (optional)"
                                    maxLength={1000}
                                    rows={2}
                                    className="rounded-lg border border-gray-300 px-3 py-2"
                                    disabled={assigningId === issue.issue_id}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => assignIssue(issue.issue_id)}
                                    disabled={
                                      assigningId === issue.issue_id ||
                                      !selectedStaff[issue.issue_id] ||
                                      Number(selectedStaff[issue.issue_id]) ===
                                        Number(assignment?.staff_user_id) ||
                                      staffList.length === 0
                                    }
                                    className="rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {assigningId === issue.issue_id
                                      ? "Saving..."
                                      : assignment
                                        ? "Reassign to Staff"
                                        : "Assign to Staff"}
                                  </button>

                                  {staffList.length === 0 && (
                                    <p className="text-xs text-red-600">
                                      No staff accounts available.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Assignment unavailable
                                </span>
                              )}
                            </td>

                            {/* Status Update Controls */}
                            <td className="px-5 py-4">
                              <div className="flex min-w-40 flex-col gap-2">

                                <select
                                  value={
                                    selectedStatuses[issue.issue_id] ??
                                    issue.status
                                  }
                                  onChange={(event) =>
                                    setSelectedStatuses((previous) => ({
                                      ...previous,
                                      [issue.issue_id]: event.target.value,
                                    }))
                                  }
                                  className="rounded-lg border border-gray-300 px-2 py-2"
                                >
                                  {availableStatuses.map((status) => (
                                    <option
                                      key={status}
                                      value={status}
                                    >
                                      {formatStatus(status)}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateIssueStatus(issue.issue_id)
                                  }
                                  disabled={
                                    updatingId === issue.issue_id
                                  }
                                  className="rounded-lg bg-green-700 px-3 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                                >
                                  {updatingId === issue.issue_id
                                    ? "Updating..."
                                    : "Update"}
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })}

                    </tbody>
                  </table>

                </div>
              )}

            </div>

            {/* Staff Management */}
            <section className="mt-10 rounded-xl border bg-white shadow-sm">
              <div className="border-b px-6 py-5">
                <h2 className="text-xl font-bold">Staff Management</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create staff accounts and view the staff members who can receive issue assignments.
                </p>
              </div>

              <div className="grid gap-8 p-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-4 font-semibold">Create New Staff Account</h3>

                  <form onSubmit={createStaff} className="space-y-4">
                    <div>
                      <label htmlFor="new-staff-name" className="mb-1 block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        id="new-staff-name"
                        type="text"
                        value={newStaffName}
                        onChange={(event) => setNewStaffName(event.target.value)}
                        required
                        minLength={2}
                        maxLength={100}
                        autoComplete="name"
                        placeholder="Enter staff member's full name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-staff-email" className="mb-1 block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        id="new-staff-email"
                        type="email"
                        value={newStaffEmail}
                        onChange={(event) => setNewStaffEmail(event.target.value)}
                        required
                        maxLength={254}
                        autoComplete="email"
                        placeholder="staff2@civictrack.com"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label htmlFor="new-staff-password" className="mb-1 block text-sm font-medium text-gray-700">
                        Temporary Password
                      </label>
                      <input
                        id="new-staff-password"
                        type="password"
                        value={newStaffPassword}
                        onChange={(event) => setNewStaffPassword(event.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>

                    {staffError && (
                      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {staffError}
                      </p>
                    )}

                    {staffMessage && (
                      <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                        {staffMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={creatingStaff}
                      className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingStaff ? "Creating Account..." : "Create Staff Account"}
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="mb-4 font-semibold">
                    Registered Staff Members ({staffList.length})
                  </h3>

                  {staffList.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-5 text-sm text-gray-500">
                      No staff accounts have been created yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {staffList.map((staff) => (
                        <div
                          key={staff.user_id}
                          className="rounded-lg border p-4"
                        >
                          <p className="font-semibold">{staff.full_name}</p>
                          <p className="text-sm text-gray-600">{staff.email}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            Staff ID: {staff.user_id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Feedback Management */}
            <section className="mt-10 rounded-xl border bg-white shadow-sm">
              <div className="border-b px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      Citizen Feedback
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Review ratings and comments submitted by citizens after issue resolution.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadFeedback}
                    disabled={feedbackLoading}
                    className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    {feedbackLoading ? "Refreshing..." : "Refresh Feedback"}
                  </button>
                </div>
              </div>

              {feedbackLoading && feedbackList.length === 0 ? (
                <p className="p-6 text-gray-500">
                  Loading feedback...
                </p>
              ) : feedbackError ? (
                <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  {feedbackError}
                </div>
              ) : (
                <div className="p-6">

                  {/* Feedback Statistics */}
                  <div className="mb-6 grid gap-5 sm:grid-cols-2">
                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-sm text-gray-500">
                        Total Feedback Submissions
                      </p>
                      <h3 className="mt-2 text-3xl font-bold">
                        {feedbackList.length}
                      </h3>
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-sm text-gray-500">
                        Average Rating
                      </p>
                      <h3 className="mt-2 text-3xl font-bold">
                        {averageRating.toFixed(1)} / 5
                      </h3>
                      <p className="mt-1 text-xl text-yellow-500">
                        {feedbackList.length > 0
                          ? "★".repeat(Math.round(averageRating))
                          : "No ratings yet"}
                      </p>
                    </div>
                  </div>

                  {/* Feedback List */}
                  <h3 className="mb-4 text-lg font-semibold">
                    Submitted Feedback
                  </h3>

                  {feedbackList.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                      No feedback has been submitted yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feedbackList.map((item) => (
                        <article
                          key={item.feedback_id}
                          className="rounded-xl border p-5"
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {item.citizen_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {item.citizen_email}
                              </p>
                            </div>

                            <div className="text-sm text-gray-500">
                              {new Date(item.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg bg-gray-50 p-4">
                            <p className="font-semibold">
                              Issue #{item.issue_id}: {item.issue_title}
                            </p>

                            <p className="mt-2 text-xl text-yellow-500">
                              {"★".repeat(item.rating)}
                              {"☆".repeat(5 - item.rating)}
                              <span className="ml-2 text-sm text-gray-600">
                                {item.rating}/5
                              </span>
                            </p>

                            <div className="mt-3">
                              <p className="text-xs font-semibold uppercase text-gray-500">
                                Citizen Comments
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-gray-700">
                                {item.comments || "No comments provided."}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

          </>
        )}

      </section>
    </main>
  );
}
