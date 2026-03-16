import type { Request, Response } from "express";
import log from "../../common/logger.js";
import adminService from "../../services/admin/index.js";

async function list(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const per_page = Number(req.query.per_page ?? 20);
  const status = req.query.status !== undefined ? Number(req.query.status) : undefined;
  const q = req.query.q as string | undefined;

  const result = await adminService.list({ page, per_page, status, q });
  log.info(`Admin: listed ${result.items.length} accounts (total: ${result.total})`);
  res.json({ status: "OK", ...result }).end();
}

async function get(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await adminService.get(id);
  log.info(`Admin: retrieved account ${id}`);
  res.json({ status: "OK", user }).end();
}

async function updateStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body as { status: number };
  const user = await adminService.updateStatus(id, status);
  log.info(`Admin: updated status of account ${id} to ${status}`);
  res.json({ status: "OK", user }).end();
}

async function del(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await adminService.delete(id);
  log.info(`Admin: deleted account ${id}`);
  res.json({ status: "OK" }).end();
}

export default { list, get, updateStatus, del };
