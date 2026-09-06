import { Router } from "express";
import { listRetroSprints } from "../services/clickupExport.js";

export function createSprintsRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listRetroSprints());
  });

  return router;
}
