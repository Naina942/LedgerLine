export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  if (error?.name === "ZodError") {
    return res.status(400).json({ error: "VALIDATION_FAILED", message: "Invalid request data" });
  }
  if (error?.code === "P2002") {
    return res.status(409).json({ error: "CONFLICT", message: "A record with these details already exists" });
  }
  if (error?.code === "P2025") {
    return res.status(404).json({ error: "NOT_FOUND", message: "Requested record was not found" });
  }
  console.error("Unhandled API error", error);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
}
