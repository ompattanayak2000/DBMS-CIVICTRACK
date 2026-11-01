
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { postgresPool } from "@/lib/postgres";
import { createSession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

const dashboardByRole: Record<number, string> = {
  1: "/dashboard",
  2: "/admin",
  3: "/staff",
};

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid email and password.",
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const result = await postgresPool.query(
      `SELECT
         user_id,
         full_name,
         email,
         password_hash,
         role_id
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const roleId = Number(user.role_id);

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const redirectTo = dashboardByRole[roleId];

    if (!redirectTo) {
      return NextResponse.json(
        {
          success: false,
          message: "This account has an invalid role. Contact the administrator.",
        },
        { status: 403 }
      );
    }

    const token = await createSession({
      user_id: user.user_id,
      email: user.email,
      role_id: roleId,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      redirectTo,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role_id: roleId,
      },
    });

    response.cookies.set("civictrack_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to log in right now.",
      },
      { status: 500 }
    );
  }
}
