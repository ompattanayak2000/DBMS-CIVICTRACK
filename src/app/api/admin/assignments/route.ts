
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

const assignmentSchema = z.object({
  issue_id: z.number().int().positive(),
  staff_user_id: z.number().int().positive(),
  notes: z.string().trim().max(1000).optional(),
});

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("civictrack_session")?.value;

  if (!token) {
    return { authorized: false as const, status: 401 };
  }

  const session = await verifySession(token);

  if (!session) {
    return { authorized: false as const, status: 401 };
  }

  const result = await postgresPool.query(
    "SELECT role_id FROM users WHERE user_id = $1",
    [session.user_id]
  );

  if (
    result.rows.length === 0 ||
    Number(result.rows[0].role_id) !== 2
  ) {
    return { authorized: false as const, status: 403 };
  }

  return {
    authorized: true as const,
    userId: session.user_id,
  };
}

// GET: View the latest assignment for each issue
export async function GET() {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: auth.status }
      );
    }

    const result = await postgresPool.query(`
      SELECT DISTINCT ON (a.issue_id)
        a.assignment_id,
        a.issue_id,
        a.staff_user_id,
        a.assigned_by,
        a.assigned_at,
        a.notes,
        u.full_name AS staff_name,
        u.email AS staff_email,
        i.title AS issue_title,
        i.status AS issue_status
      FROM assignments a
      JOIN users u ON a.staff_user_id = u.user_id
      JOIN issues i ON a.issue_id = i.issue_id
      ORDER BY a.issue_id, a.assigned_at DESC, a.assignment_id DESC
    `);

    return NextResponse.json({
      success: true,
      assignments: result.rows,
    });
  } catch (error) {
    console.error("Assignment listing failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load assignments." },
      { status: 500 }
    );
  }
}

// POST: Assign or reassign an issue to a staff member
export async function POST(request: Request) {
  const auth = await verifyAdmin();

  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: auth.status }
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

  const validation = assignmentSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Please provide valid issue and staff IDs.",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { issue_id, staff_user_id, notes } = validation.data;
  const client = await postgresPool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Confirm that the selected user is a staff member.
    const staffResult = await client.query(
      `SELECT user_id
       FROM users
       WHERE user_id = $1 AND role_id = 3`,
      [staff_user_id]
    );

    if (staffResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          message: "Selected staff member does not exist.",
        },
        { status: 404 }
      );
    }

    // Lock the issue to prevent concurrent assignment operations.
    const issueResult = await client.query(
      `SELECT issue_id, status
       FROM issues
       WHERE issue_id = $1
       FOR UPDATE`,
      [issue_id]
    );

    if (issueResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        { success: false, message: "Issue not found." },
        { status: 404 }
      );
    }

    const oldStatus = issueResult.rows[0].status;

    if (["resolved", "closed", "rejected"].includes(oldStatus)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          message: "Resolved, closed or rejected issues cannot be assigned.",
        },
        { status: 400 }
      );
    }

    // Find the current assignment for this issue.
    const existingAssignment = await client.query(
      `SELECT assignment_id, staff_user_id
       FROM assignments
       WHERE issue_id = $1
       ORDER BY assigned_at DESC, assignment_id DESC
       LIMIT 1
       FOR UPDATE`,
      [issue_id]
    );

    let assignmentResult;
    let action: "assigned" | "reassigned";

    if (existingAssignment.rows.length > 0) {
      const currentAssignment = existingAssignment.rows[0];

      // Update the existing assignment instead of inserting a duplicate.
      assignmentResult = await client.query(
        `UPDATE assignments
         SET staff_user_id = $1,
             assigned_by = $2,
             assigned_at = CURRENT_TIMESTAMP,
             notes = $3
         WHERE assignment_id = $4
         RETURNING
           assignment_id,
           issue_id,
           staff_user_id,
           assigned_by,
           assigned_at,
           notes`,
        [
          staff_user_id,
          auth.userId,
          notes || null,
          currentAssignment.assignment_id,
        ]
      );

      action =
        Number(currentAssignment.staff_user_id) === staff_user_id
          ? "assigned"
          : "reassigned";

      // Remove any older duplicate assignment rows for this issue.
      await client.query(
        `DELETE FROM assignments
         WHERE issue_id = $1
           AND assignment_id <> $2`,
        [issue_id, currentAssignment.assignment_id]
      );
    } else {
      // Create the first assignment for this issue.
      assignmentResult = await client.query(
        `INSERT INTO assignments
          (issue_id, staff_user_id, assigned_by, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING
           assignment_id,
           issue_id,
           staff_user_id,
           assigned_by,
           assigned_at,
           notes`,
        [issue_id, staff_user_id, auth.userId, notes || null]
      );

      action = "assigned";
    }

    // Change status to assigned when necessary.
    if (oldStatus !== "assigned" && oldStatus !== "in_progress") {
      await client.query(
        `UPDATE issues
         SET status = 'assigned',
             updated_at = CURRENT_TIMESTAMP
         WHERE issue_id = $1`,
        [issue_id]
      );

      await client.query(
        `INSERT INTO issue_status_history
          (issue_id, old_status, new_status, changed_by, remarks)
         VALUES ($1, $2, 'assigned', $3, $4)`,
        [
          issue_id,
          oldStatus,
          auth.userId,
          "Issue assigned to staff member.",
        ]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return NextResponse.json(
      {
        success: true,
        action,
        message:
          action === "reassigned"
            ? "Issue reassigned successfully."
            : "Issue assigned successfully.",
        assignment: assignmentResult.rows[0],
      },
      { status: 200 }
    );
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Issue assignment failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to assign issue." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
