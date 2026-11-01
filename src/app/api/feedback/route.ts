
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

const feedbackSchema = z.object({
  issue_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comments: z.string().trim().max(2000).optional(),
});

// GET: Citizens view their feedback; admins view all feedback.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("civictrack_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    const session = await verifySession(token);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Your session is invalid." },
        { status: 401 }
      );
    }

    if (session.role_id !== 1 && session.role_id !== 2) {
      return NextResponse.json(
        { success: false, message: "Access denied." },
        { status: 403 }
      );
    }

    const isAdmin = session.role_id === 2;

    const result = await postgresPool.query(
      `SELECT
         f.feedback_id,
         f.issue_id,
         f.citizen_id,
         f.rating,
         f.comments,
         f.created_at,
         i.title AS issue_title,
         u.full_name AS citizen_name,
         u.email AS citizen_email
       FROM feedback f
       JOIN issues i ON f.issue_id = i.issue_id
       JOIN users u ON f.citizen_id = u.user_id
       ${isAdmin ? "" : "WHERE f.citizen_id = $1"}
       ORDER BY f.created_at DESC`,
      isAdmin ? [] : [session.user_id]
    );

    return NextResponse.json({
      success: true,
      feedback: result.rows,
    });
  } catch (error) {
    console.error("Fetching feedback failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load feedback." },
      { status: 500 }
    );
  }
}

// POST: Citizens submit feedback for their own resolved issues.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("civictrack_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    const session = await verifySession(token);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Your session is invalid." },
        { status: 401 }
      );
    }

    if (session.role_id !== 1) {
      return NextResponse.json(
        { success: false, message: "Only citizens can submit feedback." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const validation = feedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid rating and issue ID.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { issue_id, rating, comments } = validation.data;

    // Verify that the issue belongs to this citizen and is resolved.
    const issueResult = await postgresPool.query(
      `SELECT issue_id, status
       FROM issues
       WHERE issue_id = $1 AND citizen_id = $2`,
      [issue_id, session.user_id]
    );

    if (issueResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Issue not found or access denied." },
        { status: 404 }
      );
    }

    const status = issueResult.rows[0].status;

    if (status !== "resolved" && status !== "closed") {
      return NextResponse.json(
        {
          success: false,
          message: "Feedback can only be submitted for resolved or closed issues.",
        },
        { status: 400 }
      );
    }

    const result = await postgresPool.query(
      `INSERT INTO feedback (issue_id, citizen_id, rating, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING feedback_id, issue_id, rating, comments, created_at`,
      [issue_id, session.user_id, rating, comments || null]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully.",
        feedback: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // The database has a unique constraint on issue_id.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Feedback has already been submitted for this issue.",
        },
        { status: 409 }
      );
    }

    console.error("Submitting feedback failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to submit feedback." },
      { status: 500 }
    );
  }
}
