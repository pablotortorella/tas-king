import { describe, it, expect, vi } from 'vitest';
import { createRemoteDatabase } from '../../../scripts/tasking/remote-db.mjs';

const ok = result => ({ ok: true, json: async () => ({ success: true, result }) });
const rows = values => ({ success: true, results: values, meta: { changes: 1 } });
function setup(queryResponse = ok([rows([{ phase: 'frozen' }])]), databases = [{ name: 'source-staging', uuid: 'db-id' }]) {
  const fetchImpl = vi.fn().mockResolvedValueOnce(ok(databases)).mockResolvedValue(queryResponse);
  const tokenProvider = vi.fn().mockResolvedValue('private-token');
  const db = createRemoteDatabase({ accountId: 'account', databaseName: 'source-staging', tokenProvider, fetchImpl });
  return { db, fetchImpl };
}

describe('remote D1 adapter', () => {
  it('returns SELECT rows, first and run metadata, resolving the name once', async () => {
    const { db, fetchImpl } = setup();
    expect(await db.prepare('SELECT phase FROM control').all()).toEqual(rows([{ phase: 'frozen' }]));
    expect(await db.prepare('SELECT phase FROM control').first()).toEqual({ phase: 'frozen' });
    expect(await db.prepare('SELECT phase FROM control').first('phase')).toBe('frozen');
    expect((await db.prepare('UPDATE control SET phase=?').bind('frozen').run()).meta.changes).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const lookup = new URL(fetchImpl.mock.calls[0][0]);
    expect(lookup.searchParams.get('name')).toBe('source-staging');
    expect(lookup.searchParams.get('per_page')).toBe('100');
  });

  it('places private parameters only in the POST body', async () => {
    const { db, fetchImpl } = setup();
    const privateValue = "private@example.test'";
    await db.prepare('SELECT * FROM identities WHERE email=?').bind(privateValue).all();
    const [url, options] = fetchImpl.mock.calls[1];
    expect(url).not.toContain(privateValue);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ sql: 'SELECT * FROM identities WHERE email=?', params: [privateValue] });
  });

  it('sends a real batch with individual SQL and parameters', async () => {
    const result = [rows([]), rows([{ id: 1 }])];
    const { db, fetchImpl } = setup(ok(result));
    expect(await db.batch([db.prepare('INSERT INTO x VALUES(?)').bind(1), db.prepare('SELECT * FROM x')])).toEqual(result);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ batch: [{ sql: 'INSERT INTO x VALUES(?)', params: [1] }, { sql: 'SELECT * FROM x', params: [] }] });
  });

  it('rejects a failed individual statement even if the outer envelope succeeds', async () => {
    const { db } = setup(ok([{ success: false, error: 'private SQL detail', results: [] }]));
    await expect(db.prepare('SELECT 1').all()).rejects.toThrow('No se pudo completar');
  });

  it('rejects ambiguous names and ignores nonexact matches', async () => {
    const { db, fetchImpl } = setup(undefined, [{ name: 'source-staging', uuid: 'one' }, { name: 'source-staging', uuid: 'two' }]);
    await expect(db.prepare('SELECT 1').all()).rejects.toThrow('No se pudo completar');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const exact = setup(undefined, [{ name: 'source-staging-other', uuid: 'other' }, { name: 'source-staging', uuid: 'exact' }]);
    await exact.db.prepare('SELECT 1').all();
    expect(exact.fetchImpl.mock.calls[1][0]).toContain('/exact/query');
  });

  it.each([
    { ok: false, json: async () => ({ error: 'private-token' }) },
    { ok: true, json: async () => ({ success: false, errors: [{ message: 'private-token' }] }) },
    { ok: true, json: async () => ({ success: true, errors: [{ message: 'private-token' }], result: [] }) },
    ok([{ success: true, results: [], errors: [{ message: 'private-token' }] }]),
  ])('sanitizes HTTP, global and statement failures', async response => {
    const { db } = setup(response);
    const error = await db.prepare('SELECT private_data').all().catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toMatch(/private-token|private_data/);
    expect(error.cause).toBeUndefined();
  });

  it('sanitizes transport and credential failures', async () => {
    for (const tokenFailure of [false, true]) {
      const db = createRemoteDatabase({ accountId: 'a', databaseName: 'db', tokenProvider: async () => { if (tokenFailure) throw new Error('secret credential'); return 'secret'; }, fetchImpl: async () => { throw new Error('secret transport'); } });
      await expect(db.prepare('SELECT 1').all()).rejects.toThrow(/^No se pudo completar la operación D1 remota/);
    }
  });

  it('returns null for an empty SELECT', async () => {
    const { db } = setup(ok([rows([])]));
    expect(await db.prepare('SELECT 1 WHERE 0').first()).toBeNull();
  });
});
