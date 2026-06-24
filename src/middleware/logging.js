// ---------- Structured Logging ----------

export class Logger {
  constructor(level = "info") {
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.level = this.levels[level] || 1;
  }

  log(level, message, context = {}) {
    if (this.levels[level] < this.level) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...context
    };
    console.log(JSON.stringify(entry));
  }

  debug(message, context) { this.log("debug", message, context); }
  info(message, context) { this.log("info", message, context); }
  warn(message, context) { this.log("warn", message, context); }
  error(message, context) { this.log("error", message, context); }
}

export const logger = new Logger("info");

export function getClientIP(c) {
  return c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")?.split(",")[0] || "unknown";
}

export function createLoggingMiddleware() {
  return async (c, next) => {
    const startTime = Date.now();
    const ip = getClientIP(c);
    const method = c.req.method;
    const path = c.req.path;

    // No loguear requests a /assets o / (demasiado ruido, y / interfiere con asset serving)
    if (path.startsWith("/assets") || path === "/") {
      await next();
      return;
    }

    try {
      await next();
    } catch (e) {
      logger.error(`${method} ${path} - exception`, { ip, method, path, error: e.message });
      throw e;
    }

    try {
      const latency = Date.now() - startTime;
      const status = c.res?.status || 200;

      const context = {
        ip,
        method,
        path,
        status,
        latency,
      };

      // Agregar usuario si está disponible
      const email = c.get("email");
      if (email) context.user = email;

      // Loguear como info si OK, warn si 4xx, error si 5xx
      if (status >= 500) {
        logger.error(`${method} ${path}`, context);
      } else if (status >= 400) {
        logger.warn(`${method} ${path}`, context);
      } else {
        logger.info(`${method} ${path}`, context);
      }
    } catch (logErr) {
      // Si el logging falla, no romper el request
      console.warn("Logging failed:", logErr.message);
    }
  };
}
