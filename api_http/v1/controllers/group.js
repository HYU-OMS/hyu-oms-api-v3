import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';

const router = asyncify(express.Router());

router.get('/', async (req, res, next) => {

});

router.post('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const content = req.body || {};

  const name = content['name'];
  if(Boolean(name) === false) {
    throw createError(400, "'name' must be provided!", {
      state: 'REQUIRED_VALUE_EMPTY_ERR',
      info: ['name']
    });
  }
  else if(name.length > 64) {
    throw createError(400, "Length of 'name' must be smaller than 64!", {
      state: 'REQUIRED_VALUE_LENGTH_ERR',
      info: ['name']
    });
  }

  const db = req.mysql;
  await db.connect();
  req.db_connected = true;

  let new_group_id = undefined;
  try {
    await db.query("START TRANSACTION");

    const group_add_query = "INSERT INTO `groups` SET `name` = ?, `creator_id` = ?";
    const group_add_val = [name, req.user_info['user_id']];
    const group_add_result = await db.query(group_add_query, group_add_val);

    new_group_id = group_add_result.insertId;

    const member_update_query = "INSERT INTO `members` SET `group_id` = ?, `user_id` = ?, `role` = '2'";
    const member_update_val = [new_group_id, req.user_info['user_id']];
    await db.query(member_update_query, member_update_val);

    await db.query("COMMIT");
  } catch(err) {
    await db.query("ROLLBACK");
    throw err;
  }

  db.quit();
  req.db_connected = false;

  res.status(201);
  res.json({
    "group_id": new_group_id
  });
});

router.put('/:group_id', async (req, res, next) => {

});

router.delete('/:group_id', async (req, res, next) => {

});

export default router;