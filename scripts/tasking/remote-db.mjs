const API = 'https://api.cloudflare.com/client/v4';
const failure = () => new Error('No se pudo completar la operación D1 remota. Verificar ambiente, recursos y permisos.');

// Credentials and transport are injected; SQL, parameters and API errors never
// become command arguments or diagnostic messages.
export function createRemoteDatabase({ accountId, databaseName, tokenProvider, fetchImpl = fetch }) {
  const statements = new WeakMap();
  const accountPath = `${API}/accounts/${encodeURIComponent(accountId)}/d1/database`;
  let databaseId;

  async function request(url, body) {
    try {
      const token = await tokenProvider();
      if (typeof token !== 'string' || !token) throw failure();
      const response = await fetchImpl(url, {
        method: body === undefined ? 'GET' : 'POST',
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw failure();
      const payload = await response.json();
      if (payload?.success !== true || payload.error || (payload.errors && (!Array.isArray(payload.errors) || payload.errors.length))) throw failure();
      return payload;
    } catch {
      throw failure();
    }
  }

  async function resolveDatabase() {
    const matches = [];
    for (let page = 1; ; page++) {
      const url = new URL(accountPath);
      url.search = new URLSearchParams({ name: databaseName, per_page: '100', page: String(page) });
      const payload = await request(url);
      if (!Array.isArray(payload.result)) throw failure();
      matches.push(...payload.result.filter(db => db.name === databaseName));
      const pages = payload.result_info?.total_pages;
      if (pages !== undefined ? page >= pages : payload.result.length < 100) break;
    }
    if (matches.length !== 1 || typeof matches[0].uuid !== 'string' || !matches[0].uuid) throw failure();
    return matches[0].uuid;
  }

  async function execute(body, expected) {
    databaseId ??= resolveDatabase();
    const id = await databaseId;
    const payload = await request(`${accountPath}/${encodeURIComponent(id)}/query`, body);
    if (!Array.isArray(payload.result) || payload.result.length !== expected || payload.result.some(result =>
      result?.success !== true || result.error || (result.errors && (!Array.isArray(result.errors) || result.errors.length)) || !Array.isArray(result.results)
    )) throw failure();
    return payload.result;
  }

  function prepare(sql, params = []) {
    const statement = {
      bind(...values) { return prepare(sql, values); },
      async all() { return (await execute({ sql, params }, 1))[0]; },
      async first(column) {
        const row = (await this.all()).results[0];
        return row === undefined ? null : column === undefined ? row : row[column];
      },
      async run() { return this.all(); },
    };
    statements.set(statement, { sql, params });
    return statement;
  }

  return {
    prepare,
    async batch(items) {
      if (!Array.isArray(items)) throw failure();
      const batch = items.map(item => {
        const value = statements.get(item);
        if (!value) throw failure();
        return value;
      });
      return batch.length ? execute({ batch }, batch.length) : [];
    },
  };
}
