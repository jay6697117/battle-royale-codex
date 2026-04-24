const DIST_DIR = new URL("./dist/", import.meta.url);
const INDEX_FILE = new URL("index.html", DIST_DIR);

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const PORT = resolvePort(Deno.env.get("PORT"));

Deno.serve({ port: PORT }, async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error(error);

    return textResponse(
      "Internal Server Error",
      500,
      "text/plain; charset=utf-8",
    );
  }
});

async function handleRequest(request: Request): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return textResponse(
      "Method Not Allowed",
      405,
      "text/plain; charset=utf-8",
      {
        Allow: "GET, HEAD",
      },
    );
  }

  const url = new URL(request.url);
  const pathname = normalizePathname(url.pathname);

  if (pathname === null) {
    return textResponse("Bad Request", 400, "text/plain; charset=utf-8");
  }

  const isHeadRequest = request.method === "HEAD";
  const fileResponse = await tryServeDistFile(pathname, isHeadRequest);

  if (fileResponse !== null) {
    return fileResponse;
  }

  if (shouldReturnNotFound(pathname)) {
    return textResponse("Not Found", 404, "text/plain; charset=utf-8");
  }

  return serveFile(INDEX_FILE, "/index.html", isHeadRequest);
}

async function tryServeDistFile(
  pathname: string,
  isHeadRequest: boolean,
): Promise<Response | null> {
  const fileUrl = toDistFileUrl(pathname === "/" ? "/index.html" : pathname);

  if (fileUrl === null) {
    return null;
  }

  try {
    const fileInfo = await Deno.stat(fileUrl);

    if (!fileInfo.isFile) {
      return null;
    }

    return await serveFile(fileUrl, pathname, isHeadRequest);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }

    throw error;
  }
}

async function serveFile(
  fileUrl: URL,
  requestPathname: string,
  isHeadRequest: boolean,
): Promise<Response> {
  try {
    const body = isHeadRequest ? null : await Deno.readFile(fileUrl);
    const headers = new Headers({
      "Cache-Control": cacheControlFor(requestPathname),
      "Content-Type": contentTypeFor(fileUrl.pathname),
      "X-Content-Type-Options": "nosniff",
    });

    return new Response(body, { headers });
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound && fileUrl.href === INDEX_FILE.href
    ) {
      return textResponse(
        "Build output not found. Set the Deno Deploy build command to `npm run build`.",
        500,
        "text/plain; charset=utf-8",
      );
    }

    throw error;
  }
}

function normalizePathname(pathname: string): string | null {
  let decodedPathname: string;

  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (!decodedPathname.startsWith("/") || decodedPathname.includes("\0")) {
    return null;
  }

  return decodedPathname;
}

function toDistFileUrl(pathname: string): URL | null {
  const pathSegments = pathname.split("/").filter(Boolean);

  if (pathSegments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return new URL(pathSegments.join("/"), DIST_DIR);
}

function shouldReturnNotFound(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";

  return pathname.startsWith("/assets/") || lastSegment.includes(".");
}

function contentTypeFor(pathname: string): string {
  const extension = pathname.match(/\.[^.\/]+$/)?.[0]?.toLowerCase();

  if (extension === undefined) {
    return "application/octet-stream";
  }

  return MIME_TYPES[extension] ?? "application/octet-stream";
}

function cacheControlFor(pathname: string): string {
  if (pathname === "/" || pathname === "/index.html") {
    return "no-cache";
  }

  if (pathname.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

function resolvePort(portValue: string | undefined): number {
  if (portValue === undefined || portValue.trim() === "") {
    return 8000;
  }

  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }

  return port;
}

function textResponse(
  message: string,
  status: number,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(message, {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
    status,
  });
}
