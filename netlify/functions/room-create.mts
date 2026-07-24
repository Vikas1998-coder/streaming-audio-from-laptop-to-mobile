import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { rooms } from "../../db/schema.js";

// Creates a new streaming room. The laptop (broadcaster) calls this with its
// WebRTC offer, and receives back a short code to share with the phone.
export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { offer } = await req.json();
  if (!offer) {
    return Response.json({ error: "Missing offer" }, { status: 400 });
  }

  const code = generateCode();

  await db.insert(rooms).values({
    code,
    offer,
    broadcasterCandidates: [],
    listenerCandidates: [],
  });

  return Response.json({ code });
};

function generateCode() {
  // 6-digit numeric code, easy to read aloud or type on a phone keyboard.
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const config: Config = {
  path: "/api/rooms",
};
