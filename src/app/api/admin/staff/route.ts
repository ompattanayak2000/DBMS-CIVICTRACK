
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

// Validate staff registration details
const staffSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

// Verify that the logged-in user is an admin
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("civictrack_session")?.value;

  if (!token) {
    return {
      authorized: false as const,
      status: 401,
    };
  }

  const session = await verifySession(token);

  if (!session) {
    return {
      authorized: false as const,
      status: 401,
    };
  }

  const result = await postgresPool.query(
    `SELECT role_id
     FROM users
     WHERE user_id = $1`,
    [session.user_id]
  );

  if (
    result.rows.length === 0 ||
    Number(result.rows[0].role_id) !== 2
  ) {
    return {
      authorized: false as const,
      status: 403,
    };
  }

  return {
    authorized: true as const,
    userId: session.user_id,
  };
}

// GET: Fetch all staff accounts
export async function GET() {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required.",
        },
        { status: auth.status }
      );
    }

    const result = await postgresPool.query(
      `SELECT
         user_id,
         full_name,
         email,
         created_at
       FROM users
       WHERE role_id = 3
       ORDER BY user_id DESC`
    );

    return NextResponse.json({
      success: true,
      staff: result.rows,
    });

  } catch (error) {
    console.error("Staff listing failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load staff.",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new staff account
export async function POST(request: Request) {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required.",
        },
        { status: auth.status }
      );
    }

    // Read request body
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request.",
        },
        { status: 400 }
      );
    }

    // Validate details
    const validation = staffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter valid staff details.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { full_name, email, password } = validation.data;

    // Hash password before saving
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert staff with role_id = 3
    const result = await postgresPool.query(
      `INSERT INTO users
        (full_name, email, password_hash, role_id)
       VALUES ($1, $2, $3, 3)
       ON CONFLICT (email) DO NOTHING
       RETURNING
         user_id,
         full_name,
         email,
         role_id,
         created_at`,
      [
        full_name,
        email.toLowerCase(),
        passwordHash,
      ]
    );

    // Handle duplicate email
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Staff account created successfully.",
        staff: result.rows[0],
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Staff registration failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create staff account.",
      },
      { status: 500 }
    );
  }
}
