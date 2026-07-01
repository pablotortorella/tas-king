import { membership } from "../db/helpers.js";
import { getDoneColumnId } from "../db/columns.js";

export function setupMetricsRoutes(app) {
  app.get("/api/boards/:boardId/metrics", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const doneColId = await getDoneColumnId(c.env.DB, boardId);

    const now = Date.now();
    const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
    const weekStart  = now - 7  * 86400000;
    const monthStart = now - 30 * 86400000;

    const [periodRow, leadRow, burnupRows, wipRows] = await Promise.all([
      // A — tarjetas completadas por período (hoy / semana / mes)
      c.env.DB.prepare(`
        SELECT
          COUNT(DISTINCT CASE WHEN ts >= ? THEN card_id END) AS today,
          COUNT(DISTINCT CASE WHEN ts >= ? THEN card_id END) AS thisWeek,
          COUNT(DISTINCT CASE WHEN ts >= ? THEN card_id END) AS thisMonth
        FROM audit_log
        WHERE board_id = ? AND action IN ('card_moved','card_edited')
          AND json_extract(details, '$.column.to') = ? AND ts >= ?
      `).bind(todayStart, weekStart, monthStart, boardId, doneColId, monthStart).first(),

      // B — lead time: tiempo desde creación hasta primera llegada a columna done
      c.env.DB.prepare(`
        WITH first_done AS (
          SELECT card_id, MIN(ts) AS done_ts
          FROM audit_log
          WHERE board_id = ? AND action IN ('card_moved','card_edited')
            AND json_extract(details, '$.column.to') = ?
          GROUP BY card_id
        ),
        card_start AS (
          SELECT card_id, ts AS start_ts FROM audit_log
          WHERE board_id = ? AND action = 'card_created'
          UNION ALL
          SELECT id AS card_id, created_at AS start_ts FROM cards
          WHERE board_id = ? AND id NOT IN (
            SELECT card_id FROM audit_log WHERE action = 'card_created' AND board_id = ?
          )
        )
        SELECT
          ROUND(AVG((f.done_ts - s.start_ts) / 86400000.0), 1) AS avg_days,
          ROUND(MIN((f.done_ts - s.start_ts) / 86400000.0), 1) AS min_days,
          ROUND(MAX((f.done_ts - s.start_ts) / 86400000.0), 1) AS max_days,
          COUNT(*) AS sample
        FROM first_done f JOIN card_start s ON f.card_id = s.card_id
        WHERE f.done_ts > s.start_ts
      `).bind(boardId, doneColId, boardId, boardId, boardId).first(),

      // C — burn-up: tarjetas completadas por día (últimos 30 días)
      c.env.DB.prepare(`
        SELECT date(ts/1000, 'unixepoch') AS d, COUNT(DISTINCT card_id) AS count
        FROM audit_log
        WHERE board_id = ? AND action IN ('card_moved','card_edited')
          AND json_extract(details, '$.column.to') = ? AND ts >= ?
        GROUP BY d ORDER BY d
      `).bind(boardId, doneColId, monthStart).all(),

      // D — WIP actual por columna
      c.env.DB.prepare(`
        SELECT col.name, COUNT(c.id) AS count
        FROM columns col
        LEFT JOIN cards c ON c.column_id = col.id AND c.board_id = col.board_id AND c.archived = 0
        WHERE col.board_id = ?
        GROUP BY col.id, col.name ORDER BY col.position
      `).bind(boardId).all(),
    ]);

    // Acumular burn-up en JS
    let cumulative = 0;
    const byDate = new Map((burnupRows.results || []).map(r => [r.d, r.count]));
    const burnup = (burnupRows.results || []).map(r => {
      cumulative += r.count;
      return { date: r.d, count: r.count, cumulative };
    });
    void byDate; // referencia usada implícitamente arriba

    return c.json({
      completedByPeriod: {
        today:     periodRow?.today     ?? 0,
        thisWeek:  periodRow?.thisWeek  ?? 0,
        thisMonth: periodRow?.thisMonth ?? 0,
      },
      leadTimeDays: leadRow?.sample > 0
        ? { avg: leadRow.avg_days, min: leadRow.min_days, max: leadRow.max_days, sample: leadRow.sample }
        : null,
      burnup,
      wipByColumn: (wipRows.results || []).map(r => ({ name: r.name, count: r.count })),
    });
  });
}
