import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

const issueSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(5000),
    category_id: z.number().int().positive(),
    location_text: z.string().trim().min(3).max(500),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine(
    (data) =>
      (data.latitude === undefined && data.longitude === undefined) ||
      (data.latitude !== undefined && data.longitude !== undefined),
    {
      message: "Latitude and longitude must be provided together.",
    }
  );

// GET: Fetch issues belonging to the logged-in citizen
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
        {
          success: false,
          message: "Your session is invalid. Please log in again.",
        },
        { status: 401 }
      );
    }

    const result = await postgresPool.query(
      `SELECT
         i.issue_id,
         i.title,
         i.description,
         i.location_text,
         i.priority,
         i.status,
         i.created_at,
         i.updated_at,
         c.category_name
       FROM issues i
       JOIN categories c ON i.category_id = c.category_id
       WHERE i.citizen_id = $1
       ORDER BY i.created_at DESC`,
      [session.user_id]
    );

    return NextResponse.json({
      success: true,
      issues: result.rows,
    });
  } catch (error) {
    console.error("Fetching citizen issues failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load your issues right now.",
      },
      { status: 500 }
    );
  }
}

// POST: Submit a new civic issue
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
        {
          success: false,
          message: "Your session is invalid. Please log in again.",
        },
        { status: 401 }
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

    const validation = issueSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check the issue details.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      category_id,
      location_text,
      latitude,
      longitude,
    } = validation.data;

    const client = await postgresPool.connect();

    try {
      await client.query("BEGIN");

      const categoryResult = await client.query(
        "SELECT category_id FROM categories WHERE category_id = $1",
        [category_id]
      );

      if (categoryResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          { success: false, message: "Please select a valid category." },
          { status: 400 }
        );
      }

      const issueResult = await client.query(
        `INSERT INTO issues
          (citizen_id, category_id, title, description, location_text,
           latitude, longitude, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'reported')
         RETURNING issue_id, title, description, category_id,
                   location_text, status, created_at`,
        [
          session.user_id,
          category_id,
          title,
          description,
          location_text,
          latitude ?? null,
          longitude ?? null,
        ]
      );

      const issue = issueResult.rows[0];

      await client.query(
        `INSERT INTO issue_status_history
          (issue_id, old_status, new_status, changed_by, remarks)
         VALUES ($1, NULL, 'reported', $2, $3)`,
        [
          issue.issue_id,
          session.user_id,
          "Issue reported by citizen",
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          message: "Issue reported successfully.",
          issue,
        },
        { status: 201 }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Issue creation failed:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to report the issue right now.",
        },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Issue submission failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to report the issue right now.",
      },
      { status: 500 }
    );
  }
}