
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Category = {
  category_id: number;
  category_name: string;
  description: string | null;
};

export default function ReportIssuePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/categories");
        const result = await response.json();

        if (response.ok && result.success) {
          setCategories(result.categories);
        } else {
          setMessage("Unable to load issue categories.");
          setIsError(true);
        }
      } catch {
        setMessage("Unable to connect while loading categories.");
        setIsError(true);
      }
    }

    loadCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsLoading(true);

    try {
      const payload: {
        title: string;
        description: string;
        category_id: number;
        location_text: string;
        latitude?: number;
        longitude?: number;
      } = {
        title,
        description,
        category_id: Number(categoryId),
        location_text: locationText,
      };

      if (latitude.trim() !== "" || longitude.trim() !== "") {
        if (latitude.trim() === "" || longitude.trim() === "") {
          setIsError(true);
          setMessage(
            "Enter both latitude and longitude, or leave both blank."
          );
          return;
        }

        payload.latitude = Number(latitude);
        payload.longitude = Number(longitude);

        if (
          !Number.isFinite(payload.latitude) ||
          !Number.isFinite(payload.longitude) ||
          payload.latitude < -90 ||
          payload.latitude > 90 ||
          payload.longitude < -180 ||
          payload.longitude > 180
        ) {
          setIsError(true);
          setMessage("Please enter valid latitude and longitude values.");
          return;
        }
      }

      // Step 1: Create issue in PostgreSQL
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setIsError(true);
        setMessage(result.message || "Unable to submit your issue.");
        return;
      }

      const issueId = result.issue.issue_id;

      // Step 2: Upload evidence images to MongoDB GridFS
      if (evidenceFiles.length > 0) {
        setMessage("Issue created. Uploading evidence images...");

        const formData = new FormData();

        evidenceFiles.forEach((file) => {
          formData.append("files", file);
        });

        const evidenceResponse = await fetch(
          `/api/issues/${issueId}/evidence`,
          {
            method: "POST",
            credentials: "same-origin",
            body: formData,
          }
        );

        const evidenceResult = await evidenceResponse.json();

        if (!evidenceResponse.ok) {
          setIsError(true);
          setMessage(
            `Issue #${issueId} was created, but evidence upload failed: ${
              evidenceResult.message || "Please try again."
            }`
          );
          return;
        }

        setMessage(
          `Issue #${issueId} submitted successfully with ${evidenceFiles.length} evidence image(s)!`
        );
      } else {
        setMessage(`Issue submitted successfully! Issue ID: ${issueId}`);
      }

      // Step 3: Reset form
      setTitle("");
      setDescription("");
      setCategoryId("");
      setLocationText("");
      setLatitude("");
      setLongitude("");
      setEvidenceFiles([]);

      const fileInput = document.getElementById(
        "evidence"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error("Issue submission failed:", error);
      setIsError(true);
      setMessage("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

        <Link
          href="/dashboard"
          className="font-semibold text-green-700 hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="mt-5 text-2xl font-bold">
          Report a Civic Issue
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Submit details about the civic issue. You can also attach
          photographs as evidence.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">

          {/* Issue Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium"
            >
              Issue Title
            </label>

            <input
              id="title"
              type="text"
              required
              minLength={5}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Large pothole near main road"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="mb-1 block text-sm font-medium"
            >
              Issue Category
            </label>

            <select
              id="category"
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            >
              <option value="">Select a category</option>

              {categories.map((category) => (
                <option
                  key={category.category_id}
                  value={category.category_id}
                >
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium"
            >
              Issue Description
            </label>

            <textarea
              id="description"
              required
              minLength={10}
              maxLength={5000}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the civic issue in detail..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="location"
              className="mb-1 block text-sm font-medium"
            >
              Issue Location
            </label>

            <input
              id="location"
              type="text"
              required
              minLength={3}
              maxLength={500}
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              placeholder="e.g. Near PES University main gate"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div>
              <label
                htmlFor="latitude"
                className="mb-1 block text-sm font-medium"
              >
                Latitude (optional)
              </label>

              <input
                id="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="e.g. 12.9716"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <div>
              <label
                htmlFor="longitude"
                className="mb-1 block text-sm font-medium"
              >
                Longitude (optional)
              </label>

              <input
                id="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="e.g. 77.5946"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
            </div>

          </div>

          {/* Evidence Upload */}
          <div>
            <label
              htmlFor="evidence"
              className="mb-1 block text-sm font-medium"
            >
              Evidence Images (optional)
            </label>

            <input
              id="evidence"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                const files = Array.from(
                  event.target.files ?? []
                );

                if (files.length > 3) {
                  setEvidenceFiles([]);
                  event.target.value = "";
                  setIsError(true);
                  setMessage("You can upload a maximum of 3 images.");
                  return;
                }

                if (
                  files.some(
                    (file) => file.size > 5 * 1024 * 1024
                  )
                ) {
                  setEvidenceFiles([]);
                  event.target.value = "";
                  setIsError(true);
                  setMessage("Each image must be smaller than 5 MB.");
                  return;
                }

                setEvidenceFiles(files);
                setMessage("");
                setIsError(false);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
            />

            <p className="mt-1 text-xs text-gray-500">
              Upload up to 3 JPEG, PNG or WebP images.
              Maximum 5 MB per image.
            </p>

            {evidenceFiles.length > 0 && (
              <div className="mt-2 rounded-lg bg-green-50 p-3">
                <p className="text-sm font-medium text-green-800">
                  {evidenceFiles.length} image(s) selected:
                </p>

                <ul className="mt-1 list-inside list-disc text-sm text-green-700">
                  {evidenceFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`text-sm ${
                isError ? "text-red-600" : "text-green-700"
              }`}
            >
              {message}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || categories.length === 0}
            className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? "Submitting issue..."
              : "Submit issue"}
          </button>

        </form>
      </div>
    </main>
  );
}
