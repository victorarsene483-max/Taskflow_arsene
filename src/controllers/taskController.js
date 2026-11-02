import pool from "../db/index.js";

const STATUSES = ["pending", "in_progress", "completed"];
const PRIORITIES = ["low", "medium", "high"];

async function createTask(req, res) {
  const { project_id, title, description, status, priority, due_date } =
    req.body ?? {};

  const projectId = Number(project_id);
  if (!Number.isInteger(projectId) || projectId < 1) {
    return res
      .status(400)
      .json({ error: "project_id must be a positive integer" });
  }
  if (typeof title !== "string" || !title.trim() || title.trim().length > 255) {
    return res
      .status(400)
      .json({ error: "title is required (max 255 characters)" });
  }
  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return res.status(400).json({ error: "description must be text" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return res
      .status(400)
      .json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
  }
  if (
    due_date !== undefined &&
    due_date !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(due_date)
  ) {
    return res
      .status(400)
      .json({ error: "due_date must be a date like 2026-11-15" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, due_date)
       SELECT $1::int, $2, $3, $4, $5, $6::date
       WHERE EXISTS (SELECT 1 FROM projects WHERE id = $1 AND owner_id = $7)
       RETURNING id, project_id, title, description, status, priority, due_date, created_at`,
      [
        projectId,
        title.trim(),
        description ? description.trim() : null,
        status ?? "pending",
        priority ?? "medium",
        due_date || null,
        req.userId,
      ],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("createTask error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}

async function listTask(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT tasks.id, tasks.title, tasks.status, tasks.priority,
              to_char(tasks.due_date, 'YYYY-MM-DD') AS due_date,
              projects.name AS project_name
       FROM tasks
       JOIN projects ON projects.id = tasks.project_id
       WHERE projects.owner_id = $1
       ORDER BY tasks.created_at DESC
       LIMIT 10`,
      [req.userId],
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("listTask error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
async function updateTaskStatus(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res
      .status(400)
      .json({ error: "Task id must be a positive integer" });
  }

  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE tasks
       SET status = $1
       WHERE id = $2
         AND project_id IN (SELECT id FROM projects WHERE owner_id = $3)
       RETURNING id, project_id, title, status`,
      [status, id, req.userId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("updateTaskStatus error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
async function deleteTask(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res
      .status(400)
      .json({ error: "Task id must be a positive integer" });
  }

  try {
    const { rows } = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1
         AND project_id IN (SELECT id FROM projects WHERE owner_id = $2)
       RETURNING id`,
      [id, req.userId],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("deleteTask error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
async function getStats(req,res){
  try{
    const{rows} = await pool.query(
       `SELECT
         (SELECT COUNT(*)::int FROM projects WHERE owner_id = $1) AS projects,
         COUNT(tasks.id)::int AS tasks,
         COUNT(*) FILTER (WHERE tasks.status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE tasks.status = 'in_progress')::int AS in_progress
       FROM tasks
       JOIN projects ON projects.id = tasks.project_id
       WHERE projects.owner_id = $1`,
      [req.userId],
    );
    return res.status(200).json(rows[0]);
  } catch(err){
    console.error("getStats error:",err);
    return res.status(500).json({error:"Something went wrong.Please try again."})
  }
}



export { createTask, listTask, updateTaskStatus,deleteTask,getStats };
