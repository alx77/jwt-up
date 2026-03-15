import { pg } from "../../utils/KnexHelper.js";
import log from "../../common/logger.js";
import StatusError from "../../exceptions/StatusError.js";
import { encode, decode } from "../../utils/UuidBase64.js";
import type { UserDto } from "../../types/index.js";

interface ListParams {
  page: number;
  per_page: number;
  status?: number;
  q?: string;
}

interface ListResult {
  items: UserDto[];
  total: number;
  page: number;
  per_page: number;
}

class AdminService {
  async list(params: ListParams): Promise<ListResult> {
    const { page, per_page, status, q } = params;
    const offset = (page - 1) * per_page;

    let countQuery = pg("account").count("id as count");
    let itemsQuery = pg("account").select("uid", "login", "email", "name", "start_date", "status");

    if (status !== undefined) {
      countQuery = countQuery.where({ status });
      itemsQuery = itemsQuery.where({ status });
    }

    if (q) {
      const filter = (qb: any) =>
        qb.whereLike("login", `%${q}%`).orWhereLike("email", `%${q}%`);
      countQuery = countQuery.where(filter);
      itemsQuery = itemsQuery.where(filter);
    }

    const countResult = await countQuery;
    const total = Number((countResult as any[])[0]?.count ?? 0);

    const rows = await itemsQuery.orderBy("id", "asc").limit(per_page).offset(offset);
    log.debug(`admin list: ${(rows as any[]).length} rows, total: ${total}`);

    const items: UserDto[] = (rows as any[]).map((row) => ({
      user_id: encode(row.uid),
      login: row.login,
      email: row.email,
      name: row.name,
      start_date: row.start_date,
      status: row.status,
    }));

    return { items, total, page, per_page };
  }

  async get(id: string): Promise<UserDto> {
    const uid = decode(id);
    const rows = await pg("account")
      .select("uid", "login", "email", "name", "start_date", "status")
      .where({ uid });

    const row = (rows as any[])[0];
    if (!row) throw new StatusError(404, "USER_NOT_FOUND");
    log.debug(`admin get: found user ${id}`);
    return {
      user_id: id,
      login: row.login,
      email: row.email,
      name: row.name,
      start_date: row.start_date,
      status: row.status,
    };
  }

  async updateStatus(id: string, status: number): Promise<UserDto> {
    const uid = decode(id);
    const rows = await pg("account")
      .update({ status })
      .where({ uid })
      .returning(["uid", "login", "email", "name", "start_date", "status"]);

    const row = (rows as any[])[0];
    if (!row) throw new StatusError(404, "USER_NOT_FOUND");
    log.debug(`admin updateStatus: updated user ${id} to status ${status}`);
    return {
      user_id: id,
      login: row.login,
      email: row.email,
      name: row.name,
      start_date: row.start_date,
      status: row.status,
    };
  }

  async delete(id: string): Promise<void> {
    const uid = decode(id);
    const rows = await pg("account").delete().where({ uid }).returning(["id"]);

    if (!(rows as any[])[0]) throw new StatusError(404, "USER_NOT_FOUND");
    log.debug(`admin delete: deleted user ${id}`);
  }
}

export default new AdminService();
