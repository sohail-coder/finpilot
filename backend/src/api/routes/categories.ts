import { Router } from "express";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { createCategorySchema, updateCategorySchema } from "../../utils/validation";
import { CategoryService } from "../../services/CategoryService";

const router = Router();
const categoryService = new CategoryService();

// GET /api/categories
router.get("/", asyncHandler(async (req, res) => {
  const categories = await categoryService.list(req.user.userId);
  res.json({ success: true, data: categories });
}));

// GET /api/categories/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const cat = await categoryService.getById(String(req.params.id), req.user.userId);
  res.json({ success: true, data: cat });
}));

// POST /api/categories
router.post(
  "/",
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const cat = await categoryService.create(req.user.userId, req.body);
    res.status(201).json({ success: true, data: cat });
  })
);

// PATCH /api/categories/:id
router.patch(
  "/:id",
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const cat = await categoryService.update(String(req.params.id), req.user.userId, req.body);
    res.json({ success: true, data: cat });
  })
);

// DELETE /api/categories/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  await categoryService.delete(String(req.params.id), req.user.userId);
  res.json({ success: true, message: "Deleted" });
}));

export { router as categoryRoutes };
