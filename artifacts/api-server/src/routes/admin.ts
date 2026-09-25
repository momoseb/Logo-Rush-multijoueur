import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, catalogItemsTable, themesTable, makeCatalogItemId } from "@workspace/db";
import { refreshCatalog } from "../game";
import { logger } from "../lib/logger";

const adminRouter: IRouter = Router();

// Unlike /logo-audit (read-only, deliberately unauthenticated), this router
// writes to the catalog — gate it behind a shared secret. The app has no
// user accounts, so a bearer token is the simplest thing that isn't wide
// open. If ADMIN_TOKEN isn't configured, the whole router is locked down
// rather than falling open.
function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    res.status(503).json({ error: "Admin interface is not configured on this server." });
    return;
  }
  const header = req.headers.authorization;
  const providedToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (providedToken !== configuredToken) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}

adminRouter.use("/admin", requireAdminToken);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

adminRouter.get("/admin/themes", async (_req, res) => {
  const themes = await db.select().from(themesTable).orderBy(asc(themesTable.sortOrder));
  res.json(themes);
});

// Full schema (incl. imageProvider/aspect ratio) so a theme can be created
// from scratch, e.g. by scripts/src/seed-catalog/push-remote.ts when
// direct DB access isn't available. PATCH below deliberately keeps a
// restricted subset for routine edits of an already-existing theme.
const themeCreateSchema = z.object({
  id: z.string().min(1),
  nameFr: z.string().min(1),
  nameEn: z.string().min(1),
  imageProvider: z.string().min(1),
  aspectW: z.number().int().default(1),
  aspectH: z.number().int().default(1),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

adminRouter.post("/admin/themes", async (req, res): Promise<void> => {
  const input = themeCreateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  await db.insert(themesTable).values(input.data).onConflictDoUpdate({ target: themesTable.id, set: input.data });
  await refreshCatalog();
  logger.info({ themeId: input.data.id }, "Admin created/updated a theme");
  res.status(201).json({ ok: true, id: input.data.id });
});

const themeUpdateSchema = z.object({
  nameFr: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRouter.patch("/admin/themes/:id", async (req, res): Promise<void> => {
  const input = themeUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  await db.update(themesTable).set(input.data).where(eq(themesTable.id, req.params.id));
  await refreshCatalog();
  logger.info({ themeId: req.params.id, changes: input.data }, "Admin updated a theme");
  res.json({ ok: true });
});

adminRouter.get("/admin/catalog", async (req, res): Promise<void> => {
  const themeId = String(req.query.themeId || "");
  if (!themeId) {
    res.status(400).json({ error: "themeId query param is required." });
    return;
  }
  const items = await db
    .select()
    .from(catalogItemsTable)
    .where(eq(catalogItemsTable.themeId, themeId))
    .orderBy(asc(catalogItemsTable.answerFr));
  res.json(items);
});

const catalogItemSchema = z.object({
  id: z.string().min(1).optional(),
  themeId: z.string().min(1),
  answerFr: z.string().min(1),
  answerEn: z.string().min(1),
  aliasesFr: z.array(z.string()).default([]),
  aliasesEn: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  category: z.string().nullable().optional(),
  imageRef: z.string().min(1),
  active: z.boolean().default(true),
});

adminRouter.post("/admin/catalog", async (req, res): Promise<void> => {
  const input = catalogItemSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const id = input.data.id || makeCatalogItemId(input.data.themeId, slugify(input.data.answerEn));
  const row = { ...input.data, id };
  await db.insert(catalogItemsTable).values(row).onConflictDoUpdate({ target: catalogItemsTable.id, set: { ...row, updatedAt: new Date() } });
  await refreshCatalog();
  logger.info({ id }, "Admin created/updated a catalog item");
  res.status(201).json({ ok: true, id });
});

const catalogItemPatchSchema = catalogItemSchema.omit({ id: true, themeId: true }).partial();

adminRouter.patch("/admin/catalog/:id", async (req, res): Promise<void> => {
  const input = catalogItemPatchSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  await db.update(catalogItemsTable).set({ ...input.data, updatedAt: new Date() }).where(eq(catalogItemsTable.id, req.params.id));
  await refreshCatalog();
  logger.info({ id: req.params.id, changes: input.data }, "Admin updated a catalog item");
  res.json({ ok: true });
});

adminRouter.delete("/admin/catalog/:id", async (req, res) => {
  await db.delete(catalogItemsTable).where(eq(catalogItemsTable.id, req.params.id));
  await refreshCatalog();
  logger.info({ id: req.params.id }, "Admin deleted a catalog item");
  res.json({ ok: true });
});

const bulkImportSchema = z.array(catalogItemSchema).max(2000);

adminRouter.post("/admin/catalog/bulk", async (req, res): Promise<void> => {
  const input = bulkImportSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  for (const item of input.data) {
    const id = item.id || makeCatalogItemId(item.themeId, slugify(item.answerEn));
    const row = { ...item, id };
    await db.insert(catalogItemsTable).values(row).onConflictDoUpdate({ target: catalogItemsTable.id, set: { ...row, updatedAt: new Date() } });
  }
  await refreshCatalog();
  logger.info({ count: input.data.length }, "Admin bulk-imported catalog items");
  res.status(201).json({ ok: true, count: input.data.length });
});

export default adminRouter;
