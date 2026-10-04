import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "./core";

const handlers = process.env.UPLOADTHING_TOKEN
  ? createRouteHandler({ router: uploadRouter, config: { token: process.env.UPLOADTHING_TOKEN } })
  : null;

function notConfigured() {
  return Response.json(
    { error: "Uploads are not configured. Set UPLOADTHING_TOKEN in your environment." },
    { status: 503 },
  );
}

export const GET = handlers?.GET ?? notConfigured;
export const POST = handlers?.POST ?? notConfigured;
