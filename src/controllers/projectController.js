import pool from '../db/index.js';
//Create project
async function createProject(req, res) {
  const { name, description } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
    return res.status(400).json({ error: 'name is required (max 255 characters)' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be text' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, owner_id, created_at, updated_at`,
      [name.trim(), (description ?? '').trim(), req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createProject error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
//List project
async function listProjects(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT projects.id, projects.name, projects.description, projects.owner_id,
              projects.created_at, projects.updated_at,
              COUNT(tasks.id)::int AS task_count,
              COUNT(tasks.id) FILTER (WHERE tasks.status = 'completed')::int AS completed_count
       FROM projects
       LEFT JOIN tasks ON tasks.project_id = projects.id
       WHERE projects.owner_id = $1
       GROUP BY projects.id
       ORDER BY projects.created_at DESC`,
      [req.userId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('listProjects error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
//Get projects
async function getProject(req,res){
  const id = Number(req.params.id);
  if(!Number.isInteger(id)|| id<1){
    return res.status(400).json({error:'Project id must be a positive integer'});
  }
  
  
  try{
 const { rows } = await pool.query(
  `SELECT id, name, description, owner_id, created_at, updated_at
   FROM projects
   WHERE id = $1 AND owner_id = $2`,
  [id, req.userId]
 
);

    const project = rows[0];
    if(!project){
      return res.status(404).json({error:'Project not found'})
    } res.status(200).json(project)
  } catch(err){
    console.error('getProject error:',err)
    res.status(500).json({error:'Something went wrong.Please try again.'})
  }


}
//Update project

async function updateProject(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Project id must be a positive integer' });
  }

  const { name, description } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
    return res.status(400).json({ error: 'name is required (max 255 characters)' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be text' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE projects
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND owner_id = $4
       RETURNING id, name, description, owner_id, created_at, updated_at`,
      [name.trim(), (description ?? '').trim(), id, req.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('updateProject error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
//delete project
async function deleteProject(req,res){
  const id = Number(req.params.id)
  if(!Number.isInteger(id)|| id<1){
    return res.status(400).json({error:'Project id must be a positive integer'})
    
  }
  try{
    const {rows} = await pool.query(`
      DELETE FROM projects
      WHERE id = $1 AND owner_id = $2
      RETURNING id`,
    [id,req.userId]);
    if(!rows[0]){
      return res.status(404).json({error:'Project not found'});
    }
  res.status(204).send();
  } catch(err){
    console.error('deleteProject error:',err);
    res.status(500).json({error:'Something went wrong.Please try again.'})

  }
}


export { createProject,listProjects,getProject,updateProject,deleteProject};