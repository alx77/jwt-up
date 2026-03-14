import type { Request, Response } from "express";

async function exec(_req: Request, res: Response): Promise<void> {
  res
    .status(200)
    .json({
      status: "UP",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
    .end();
}

export default { exec };
