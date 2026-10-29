
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center justify-between border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-bold text-green-700">
          CivicTrack
        </h1>

        <div className="flex gap-4">
          <a
            href="/login"
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100"
          >
            Login
          </a>
          <a
            href="/register"
            className="rounded-lg bg-green-700 px-4 py-2 text-white hover:bg-green-800"
          >
            Register
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="mb-4 font-semibold uppercase tracking-widest text-green-700">
          Better cities start with us
        </p>

        <h2 className="text-4xl font-bold leading-tight md:text-6xl">
          Report civic issues.
          <br />
          Track real progress.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Report problems in your neighbourhood, follow their progress,
          and help make your community a better place to live.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="/register"
            className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
          >
            Report an Issue
          </a>

          <a
            href="/login"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold hover:bg-gray-100"
          >
            Track Your Issues
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-lg font-bold">Report Issues</h3>
          <p className="mt-2 text-gray-600">
            Report problems such as potholes, waste accumulation, and
            damaged streetlights.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-lg font-bold">Track Progress</h3>
          <p className="mt-2 text-gray-600">
            Follow issue updates from reporting through resolution.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h3 className="text-lg font-bold">Community Feedback</h3>
          <p className="mt-2 text-gray-600">
            Share feedback after an issue has been resolved.
          </p>
        </div>
      </section>

      <footer className="border-t bg-white px-6 py-5 text-center text-sm text-gray-500">
        CivicTrack — Building better communities together.
      </footer>
    </main>
  );
}
