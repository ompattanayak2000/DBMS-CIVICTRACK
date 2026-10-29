
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { postgresPool } from "@/lib/postgres";

const registrationSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const validation = registrationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check your registration details.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { full_name, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Always assign public registrations the citizen role.
    const roleResult = await postgresPool.query(
      "SELECT role_id FROM roles WHERE role_name = $1",
      ["citizen"]
    );

    if (roleResult.rowCount !== 1) {
      console.error("Citizen role is missing from the roles table.");

      return NextResponse.json(
        { success: false, message: "Registration is temporarily unavailable." },
        { status: 500 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await postgresPool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id, full_name, email, role_id, created_at`,
      [full_name, normalizedEmail, passwordHash, roleResult.rows[0].role_id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful.",
        user: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to register right now." },
      { status: 500 }
    );
  }
}
