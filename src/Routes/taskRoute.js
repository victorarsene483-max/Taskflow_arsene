import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createTask,
  listTask,
  updateTaskStatus,
  deleteTask,
  getStats
} from "../controllers/taskController.js";

const router = Router();

router.post("/", authMiddleware, createTask);
router.get("/", authMiddleware, listTask);
router.patch("/:id/status", authMiddleware, updateTaskStatus);
router.delete("/:id", authMiddleware, deleteTask);
router.get("/stats", authMiddleware, getStats);

export default router;