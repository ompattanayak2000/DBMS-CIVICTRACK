
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Issue = {
  issue_id: number;
  title: string;
  description: string;
  location_text: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  category_name: string;
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
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

export default function MyIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadIssues() {
      try {
        const response = await fetch("/api/issues", {
          credentials: "same-origin",
        });

        const result = await response.json();

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load issues.");
        }

        setIssues(result.issues);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading issues."
        );
      } finally {
        setLoading(false);
      }
    }

    loadIssues();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-green-700">
          CivicTrack
        </Link>

        <Link
          href="/dashboard"
          className="font-semibold text-green-700 hover:text-green-900"
        >
          Back to dashboard
        </Link>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold">Track Your Issues</h1>

        <p className="mt-2 text-gray-600">
          View the civic issues you have reported and check their current status.
        </p>

        <div className="mt-6">
          <Link
            href="/report-issue"
            className="inline-block rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
          >
            + Report a New Issue
          </Link>
        </div>

        {loading && (
          <p className="mt-8 text-gray-600">Loading your issues...</p>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && issues.length === 0 && (
          <div className="mt-8 rounded-xl border bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">No issues reported yet</h2>
            <p className="mt-2 text-gray-600">
              Once you report a civic issue, it will appear here.
            </p>
          </div>
        )}

        {!loading && !error && issues.length > 0 && (
          <div className="mt-8 space-y-5">
            <p className="text-sm text-gray-600">
              Total issues reported: {issues.length}
            </p>

            {issues.map((issue) => (
              <article
                key={issue.issue_id}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Issue #{issue.issue_id}
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      {issue.title}
                    </h2>

                    <p className="mt-2 text-sm text-gray-600">
                      {issue.category_name}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold capitalize ${getStatusStyle(issue.status)}`}
                  >
                    {formatStatus(issue.status)}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-gray-700">
                  {issue.description}
                </p>

                <div className="mt-4 space-y-2 border-t pt-4 text-sm text-gray-600">
                  <p>
                    <span className="font-semibold">Location:</span>{" "}
                    {issue.location_text}
                  </p>

                  <p>
                    <span className="font-semibold">Priority:</span>{" "}
                    <span className="capitalize">{issue.priority}</span>
                  </p>

                  <p>
                    <span className="font-semibold">Reported on:</span>{" "}
                    {new Date(issue.created_at).toLocaleString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
