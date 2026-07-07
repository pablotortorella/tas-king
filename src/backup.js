// Backup de D1 a R2 y GitHub — ejecutado por el Cron Trigger cada 8h

const KEEP_DAYS = 30;

export async function runBackup(env) {
  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\.\d+/, "");
  const filename = `backups/${timestamp}.sql`;
  const results = { timestamp, r2: false, github: false, errors: [] };

  let sql;
  try {
    sql = await generateSQLDump(env.DB);
  } catch (err) {
    results.errors.push(`dump: ${err.message}`);
    return results;
  }

  // Destino 1: R2
  try {
    await env.BUCKET.put(filename, sql, {
      httpMetadata: { contentType: "text/plain" },
    });
    results.r2 = true;
    await cleanupOldBackups(env.BUCKET);
  } catch (err) {
    results.errors.push(`r2: ${err.message}`);
  }

  // Destino 2: GitHub (opcional — solo si están configurados los secrets)
  if (env.GITHUB_BACKUP_TOKEN && env.GITHUB_BACKUP_REPO) {
    try {
      await pushToGitHub(env.GITHUB_BACKUP_TOKEN, env.GITHUB_BACKUP_REPO, filename, sql);
      results.github = true;
    } catch (err) {
      results.errors.push(`github: ${err.message}`);
    }
  }

  return results;
}

async function generateSQLDump(db) {
  let sql = `-- TasKing DB Backup\n-- Generated: ${new Date().toISOString()}\nPRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n`;

  // rate_limit_log es log operativo (se purga cada 8h), no datos de usuario:
  // se excluye del dump. Al restaurar, la migración 0006 recrea la tabla vacía.
  const { results: tables } = await db.prepare(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name NOT LIKE 'd1_%'
       AND name != 'rate_limit_log'
     ORDER BY name`
  ).all();

  for (const { name, sql: createSql } of tables) {
    sql += `DROP TABLE IF EXISTS "${name}";\n`;
    sql += `${createSql};\n\n`;

    const { results: rows } = await db.prepare(`SELECT * FROM "${name}"`).all();

    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map((c) => `"${c}"`).join(", ");
      for (const row of rows) {
        const vals = Object.values(row)
          .map((v) => {
            if (v === null) return "NULL";
            if (typeof v === "number") return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");
        sql += `INSERT INTO "${name}" (${cols}) VALUES (${vals});\n`;
      }
      sql += "\n";
    }
  }

  sql += `COMMIT;\nPRAGMA foreign_keys = ON;\n`;
  return sql;
}

async function pushToGitHub(token, repo, filename, content) {
  // UTF-8 safe base64
  const encoded = btoa(
    encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p) =>
      String.fromCharCode(parseInt(p, 16))
    )
  );

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "TasKing-Backup/1.0",
    },
    body: JSON.stringify({
      message: `backup: ${new Date().toISOString()}`,
      content: encoded,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  }
}

async function cleanupOldBackups(bucket) {
  const cutoffMs = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const listed = await bucket.list({ prefix: "backups/" });

  for (const obj of listed.objects) {
    const match = obj.key.match(/backups\/(.+)\.sql$/);
    if (!match) continue;
    const ts = new Date(match[1].replace(/-(\d{2})-(\d{2})-(\d{2})Z$/, ":$1:$2:$3Z")).getTime();
    if (!isNaN(ts) && ts < cutoffMs) {
      await bucket.delete(obj.key);
    }
  }
}
