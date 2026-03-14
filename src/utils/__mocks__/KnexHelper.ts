import { vi } from "vitest";

const pgFn = vi.fn().mockImplementation(() => pgFn);

Object.assign(pgFn, {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  into: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  join: vi.fn().mockReturnThis(),

  ref: vi.fn((col) => `"${col}"`),

  raw: vi.fn().mockImplementation((sql, bindings) => ({
    toString: () => sql,
    toSQL: () => ({ sql, bindings: bindings || [] }),
  })),

  with: vi.fn(function (name, callback) {
    const cteQb = {
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      join: vi.fn().mockReturnThis(),
    };

    if (callback) {
      callback(cteQb);
    }
    return this;
  }),

  then: vi.fn(async function (resolve, reject) {
    const result = this._mockResult || [];
    if (result instanceof Error) {
      return reject(result);
    }
    return resolve(result);
  }),

  catch: vi.fn().mockReturnThis(),

  _setMockResult: function (result) {
    this._mockResult = result;
    return this;
  },

  _clearMocks: function () {
    Object.keys(this).forEach((key) => {
      if (vi.isMockFunction(this[key])) {
        this[key].mockClear();
      }
    });
    this._mockResult = undefined;
    return this;
  },
});

pgFn.mockReturnValue(pgFn);

export const pg = pgFn;
export default { pg };
