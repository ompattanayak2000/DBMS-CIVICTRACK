
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

const statusSchema = z.object({
  status: z.enum([
    "reported",
    "verified",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
    "rejected",
  ]),
  remarks: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  // 1. Verify the session
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
      { success: false, message: "Invalid session. Please log in again." },
      { status: 401 }
    );
  }

  // 2. Check admin role directly in PostgreSQL
  const userResult = await postgresPool.query(
    `SELECT role_id
     FROM users
     WHERE user_id = $1`,
    [session.user_id]
  );

  if (
    userResult.rows.length === 0 ||
    Number(userResult.rows[0].role_id) !== 2
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Access denied. Admin privileges required.",
      },
      { status: 403 }
    );
  }

  // 3. Validate issue ID
  const { issueId } = await params;
  const parsedIssueId = Number(issueId);

  if (!Number.isInteger(parsedIssueId) || parsedIssueId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid issue ID." },
      { status: 400 }
    );
  }

  // 4. Validate request body
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const validation = statusSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Please provide a valid issue status.",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { status, remarks } = validation.data;

  // 5. Update issue and history in one transaction
  let client;

  try {
    client = await postgresPool.connect();

    await client.query("BEGIN");

    // Lock the issue row while updating it
    const issueResult = await client.query(
      `SELECT issue_id, status
       FROM issues
       WHERE issue_id = $1
       FOR UPDATE`,
      [parsedIssueId]
    );

    if (issueResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { success: false, message: "Issue not found." },
        { status: 404 }
      );
    }

    const oldStatus = issueResult.rows[0].status;

    if (oldStatus === status) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "The issue already has this status.",
        },
        { status: 400 }
      );
    }

    // Update the issue
    await client.query(
      `UPDATE issues
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE issue_id = $2`,
      [status, parsedIssueId]
    );

    // Record the status change
    await client.query(
      `INSERT INTO issue_status_history
       (issue_id, old_status, new_status, changed_by, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        parsedIssueId,
        oldStatus,
        status,
        session.user_id,
        remarks || "Issue status updated by admin",
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Issue status updated successfully.",
      issue: {
        issue_id: parsedIssueId,
        old_status: oldStatus,
        new_status: status,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Issue status update failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update issue status.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
