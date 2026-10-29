
import { NextResponse } from "next/server";
import { postgresPool } from "@/lib/postgres";

export async function GET() {
  try {
    const result = await postgresPool.query(
      `SELECT category_id, category_name, description
       FROM categories
       ORDER BY category_name`
    );

    return NextResponse.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Loading categories failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load categories." },
      { status: 500 }
    );
  }
}
