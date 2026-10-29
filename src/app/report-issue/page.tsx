
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Category = {
  category_id: number;
  category_name: string;
  description: string | null;
};

export default function ReportIssuePage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
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
          setMessage("Enter both latitude and longitude, or leave both blank.");
          return;
        }

        payload.latitude = Number(latitude);
        payload.longitude = Number(longitude);

        if (
          !Number.isFinite(payload.latitude) ||
          !Number.isFinite(payload.longitude)
        ) {
          setIsError(true);
          setMessage("Latitude and longitude must be valid numbers.");
          return;
        }
      }

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

      setMessage(`Issue submitted successfully! Issue ID: ${result.issue.issue_id}`);
      setTitle("");
      setDescription("");
      setCategoryId("");
      setLocationText("");
      setLatitude("");
      setLongitude("");
    } catch {
      setIsError(true);
      setMessage("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <Link href="/dashboard" className="font-semibold text-green-700 hover:underline">
          ← Back to dashboard
        </Link>

        <h1 className="mt-6 text-3xl font-bold">Report a civic issue</h1>
        <p className="mt-2 text-gray-600">
          Provide details so the relevant civic department can investigate the problem.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Issue title
            </label>
            <input
              id="title"
              required
              minLength={5}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Large pothole near the main road"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue and how it affects the community."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div>
            <label htmlFor="location" className="mb-1 block text-sm font-medium">
              Location or address
            </label>
            <input
              id="location"
              required
              minLength={3}
              maxLength={500}
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              placeholder="Street, area, landmark, or address"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="latitude" className="mb-1 block text-sm font-medium">
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
              <label htmlFor="longitude" className="mb-1 block text-sm font-medium">
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

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`text-sm ${isError ? "text-red-600" : "text-green-700"}`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || categories.length === 0}
            className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Submitting issue..." : "Submit issue"}
          </button>
        </form>
      </div>
    </main>
  );
}
