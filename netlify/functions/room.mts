import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { rooms } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";

// Handles polling-based signaling for a single room, identified by its short
// code. Both the broadcaster (laptop) and listener (phone) poll GET to learn
// about each other's offer/answer/ICE candidates, since Netlify Functions
// don't support long-lived WebSocket connections.
export default async (req: Request, context: Context) => {
  const { code } = context.params;
  if (!code) {
    return Response.json({ error: "Missing room code" }, { status: 400 });
  }

  if (req.method === "GET") {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }
    return Response.json(room);
  }

  if (req.method === "POST") {
    const body = await req.json();

    if (body.type === "answer") {
      await db
        .update(rooms)
        .set({ answer: body.answer, updatedAt: new Date() })
        .where(eq(rooms.code, code));
      return Response.json({ ok: true });
    }

    if (body.type === "candidate") {
      const column =
        body.role === "broadcaster" ? "broadcaster_candidates" : "listener_candidates";
      await db.execute(
        sql`update rooms set ${sql.raw(column)} = ${sql.raw(column)} || ${JSON.stringify([body.candidate])}::jsonb, updated_at = now() where code = ${code}`,
      );
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown message type" }, { status: 400 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/rooms/:code",
};
