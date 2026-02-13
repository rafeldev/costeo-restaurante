import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("No autenticado");
  }
}

export type AuthUser = {
  id: string;
  email: string;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const rawUser = session?.user as { id?: string; email?: string } | undefined;
  if (!rawUser?.id || !rawUser.email) {
    return null;
  }

  return { id: rawUser.id, email: rawUser.email };
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: "No autenticado" }, { status: 401 });
}
