
"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<number, string>
  >({});

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Load dashboard data
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
  }

  useEffect(() => {
    async function initializeDashboard() {
      try {
        await loadDashboard();
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

      await loadDashboard();

      // Clear the selected status for this issue
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
                        <th className="px-5 py-4">Update Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">

                      {issues.map((issue) => (
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
                      ))}

                    </tbody>
                  </table>

                </div>
              )}

            </div>
          </>
        )}

      </section>
    </main>
  );
}
