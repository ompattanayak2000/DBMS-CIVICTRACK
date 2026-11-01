
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

type Evidence = {
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  url: string;
};

type Feedback = {
  feedback_id: number;
  issue_id: number;
  rating: number;
  comments: string | null;
  created_at: string;
};

type FeedbackDraft = {
  rating: number;
  comments: string;
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

function formatFileSize(size: number) {
  return `${(size / 1024).toFixed(1)} KB`;
}

export default function MyIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [evidenceByIssue, setEvidenceByIssue] =
    useState<Record<number, Evidence[]>>({});
  const [feedbackByIssue, setFeedbackByIssue] =
    useState<Record<number, Feedback>>({});
  const [feedbackDrafts, setFeedbackDrafts] =
    useState<Record<number, FeedbackDraft>>({});
  const [feedbackMessages, setFeedbackMessages] =
    useState<Record<number, string>>({});
  const [submittingIssue, setSubmittingIssue] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);

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

        const loadedIssues: Issue[] = result.issues;
        setIssues(loadedIssues);

        // Load evidence metadata for every issue.
        setEvidenceLoading(true);

        const evidenceResults = await Promise.all(
          loadedIssues.map(async (issue) => {
            try {
              const evidenceResponse = await fetch(
                `/api/issues/${issue.issue_id}/evidence`,
                { credentials: "same-origin" }
              );

              if (!evidenceResponse.ok) {
                return { issueId: issue.issue_id, evidence: [] as Evidence[] };
              }

              const evidenceResult = await evidenceResponse.json();

              return {
                issueId: issue.issue_id,
                evidence: evidenceResult.success
                  ? (evidenceResult.evidence as Evidence[])
                  : [],
              };
            } catch {
              return { issueId: issue.issue_id, evidence: [] as Evidence[] };
            }
          })
        );

        const evidenceMap: Record<number, Evidence[]> = {};

        evidenceResults.forEach((item) => {
          evidenceMap[item.issueId] = item.evidence;
        });

        setEvidenceByIssue(evidenceMap);

        // Load feedback already submitted by this citizen.
        try {
          const feedbackResponse = await fetch("/api/feedback", {
            credentials: "same-origin",
          });

          if (feedbackResponse.status === 401) {
            window.location.href = "/login";
            return;
          }

          if (feedbackResponse.ok) {
            const feedbackResult = await feedbackResponse.json();

            if (feedbackResult.success) {
              const feedbackMap: Record<number, Feedback> = {};

              (feedbackResult.feedback as Feedback[]).forEach((item) => {
                feedbackMap[item.issue_id] = item;
              });

              setFeedbackByIssue(feedbackMap);
            }
          }
        } catch (feedbackError) {
          console.error("Unable to load existing feedback:", feedbackError);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading issues."
        );
      } finally {
        setLoading(false);
        setEvidenceLoading(false);
      }
    }

    loadIssues();
  }, []);

  function updateFeedbackDraft(
    issueId: number,
    changes: Partial<FeedbackDraft>
  ) {
    setFeedbackDrafts((previous) => ({
      ...previous,
      [issueId]: {
        rating: previous[issueId]?.rating ?? 0,
        comments: previous[issueId]?.comments ?? "",
        ...changes,
      },
    }));
  }

  async function submitFeedback(issueId: number) {
    const draft = feedbackDrafts[issueId];

    if (!draft || draft.rating < 1 || draft.rating > 5) {
      setFeedbackMessages((previous) => ({
        ...previous,
        [issueId]: "Please select a rating between 1 and 5 stars.",
      }));
      return;
    }

    setSubmittingIssue(issueId);

    setFeedbackMessages((previous) => ({
      ...previous,
      [issueId]: "",
    }));

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issue_id: issueId,
          rating: draft.rating,
          comments: draft.comments.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to submit feedback.");
      }

      setFeedbackByIssue((previous) => ({
        ...previous,
        [issueId]: result.feedback as Feedback,
      }));

      setFeedbackMessages((previous) => ({
        ...previous,
        [issueId]: "Thank you! Your feedback has been submitted.",
      }));
    } catch (err) {
      setFeedbackMessages((previous) => ({
        ...previous,
        [issueId]:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      }));
    } finally {
      setSubmittingIssue(null);
    }
  }

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

            {issues.map((issue) => {
              const evidence = evidenceByIssue[issue.issue_id] ?? [];
              const existingFeedback = feedbackByIssue[issue.issue_id];
              const draft = feedbackDrafts[issue.issue_id] ?? {
                rating: 0,
                comments: "",
              };
              const isEligible =
                issue.status === "resolved" || issue.status === "closed";

              return (
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

                  {/* Evidence Images */}
                  <div className="mt-5 border-t pt-5">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Evidence Images
                    </h3>

                    {evidenceLoading &&
                      evidenceByIssue[issue.issue_id] === undefined && (
                        <p className="mt-2 text-sm text-gray-500">
                          Loading evidence...
                        </p>
                      )}

                    {!evidenceLoading && evidence.length === 0 && (
                      <p className="mt-2 text-sm text-gray-500">
                        No evidence images uploaded for this issue.
                      </p>
                    )}

                    {evidence.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {evidence.map((file) => (
                          <div
                            key={file.fileId}
                            className="overflow-hidden rounded-lg border bg-gray-50"
                          >
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={file.url}
                                alt={`Evidence for ${issue.title}: ${file.fileName}`}
                                loading="lazy"
                                className="h-48 w-full object-cover transition hover:opacity-90"
                              />
                            </a>

                            <div className="p-3">
                              <p className="truncate text-sm font-semibold text-gray-800">
                                {file.fileName}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {formatFileSize(file.size)}
                              </p>

                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-sm font-semibold text-green-700 hover:text-green-900"
                              >
                                View full image →
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Citizen Feedback */}
                  {isEligible && (
                    <div className="mt-5 border-t pt-5">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Your Feedback
                      </h3>

                      {existingFeedback ? (
                        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4">
                          <p className="font-semibold text-green-800">
                            Feedback submitted successfully
                          </p>

                          <div
                            className="mt-2 text-xl text-yellow-500"
                            aria-label={`${existingFeedback.rating} out of 5 stars`}
                          >
                            {"★".repeat(existingFeedback.rating)}
                            {"☆".repeat(5 - existingFeedback.rating)}
                          </div>

                          {existingFeedback.comments && (
                            <p className="mt-2 text-sm text-gray-700">
                              {existingFeedback.comments}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-gray-500">
                            Submitted on{" "}
                            {new Date(
                              existingFeedback.created_at
                            ).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border bg-gray-50 p-4">
                          <p className="text-sm text-gray-600">
                            Your issue has been resolved. Please rate your
                            experience.
                          </p>

                          <p className="mt-4 text-sm font-semibold">
                            Select your rating
                          </p>

                          <div className="mt-2 flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() =>
                                  updateFeedbackDraft(issue.issue_id, {
                                    rating: star,
                                  })
                                }
                                aria-label={`Rate ${star} out of 5 stars`}
                                aria-pressed={draft.rating === star}
                                className={`text-3xl transition ${
                                  star <= draft.rating
                                    ? "text-yellow-500"
                                    : "text-gray-300"
                                } hover:scale-110`}
                              >
                                ★
                              </button>
                            ))}
                          </div>

                          <label
                            htmlFor={`feedback-${issue.issue_id}`}
                            className="mt-4 block text-sm font-semibold"
                          >
                            Comments (optional)
                          </label>

                          <textarea
                            id={`feedback-${issue.issue_id}`}
                            rows={3}
                            maxLength={2000}
                            value={draft.comments}
                            onChange={(event) =>
                              updateFeedbackDraft(issue.issue_id, {
                                comments: event.target.value,
                              })
                            }
                            placeholder="Share your experience with the resolution..."
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                          />

                          <button
                            type="button"
                            onClick={() => submitFeedback(issue.issue_id)}
                            disabled={submittingIssue === issue.issue_id}
                            className="mt-4 rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingIssue === issue.issue_id
                              ? "Submitting..."
                              : "Submit Feedback"}
                          </button>

                          {feedbackMessages[issue.issue_id] && (
                            <p
                              role="status"
                              className={`mt-3 text-sm ${
                                feedbackMessages[issue.issue_id].includes(
                                  "successfully"
                                )
                                  ? "text-green-700"
                                  : "text-red-600"
                              }`}
                            >
                              {feedbackMessages[issue.issue_id]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!isEligible && (
                    <div className="mt-5 border-t pt-4">
                      <p className="text-sm text-gray-500">
                        Feedback will be available once this issue is resolved
                        or closed.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
