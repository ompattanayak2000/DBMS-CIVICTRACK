
import { SignJWT, jwtVerify } from "jose";

const secretValue = process.env.AUTH_SECRET;

if (!secretValue || secretValue.length < 32) {
  throw new Error("AUTH_SECRET must be set to a strong secret.");
}

const secret = new TextEncoder().encode(secretValue);

export async function createSession(user: {
  user_id: number;
  email: string;
  role_id: number;
}) {
  return new SignJWT({
    email: user.email,
    roleId: user.role_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.roleId !== "number"
    ) {
      return null;
    }

    return {
      user_id: Number(payload.sub),
      email: payload.email,
      role_id: payload.roleId,
    };
  } catch {
    return null;
  }
}
