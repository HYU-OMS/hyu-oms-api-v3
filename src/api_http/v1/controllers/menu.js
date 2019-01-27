import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';

const router = asyncify(express.Router());

router.get('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const group_id = parseInt(req.query['group_id'], 10);
  if(isNaN(group_id)) {
    throw createError(400, "'group_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['group_id']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const chk_member_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const chk_member_val = [group_id, req.user_info['user_id']];
  const [chk_member_rows, chk_member_fields] = await req.db_connection.execute(chk_member_query, chk_member_val);

  if(chk_member_rows.length === 0) {
    throw createError(403, "Not a member of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  const get_menu_query = "SELECT `id`, `name`, `price`, `is_enabled` FROM `menus` WHERE `group_id` = ?";
  const get_menu_val = [group_id];
  const [get_menu_rows, get_menu_fields] = await req.db_connection.execute(get_menu_query, get_menu_val);

  const menus = JSON.parse(JSON.stringify(get_menu_rows));

  req.db_connection.release();

  res.status(200);
  res.json(menus);
});

router.post('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const content = req.body || {};

  const group_id = parseInt(content['group_id'], 10);
  if(isNaN(group_id)) {
    throw createError(400, "'group_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['group_id']
    });
  }

  const name = (content['name'] || "").toString();
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

  const price = parseInt(content['price'], 10);
  if(isNaN(price)) {
    throw createError(400, "'price' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['price']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  // 이전 버전에서 role check 누락됨
  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not a admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  let new_menu_id = undefined;
  try {
    await req.db_connection.query("START TRANSACTION");

    const add_menu_query = "INSERT INTO `menus` SET `name` = ?, `price` = ?, `group_id` = ?";
    const add_menu_val = [name, price, group_id];
    const [add_menu_rows, add_menu_fields] = await req.db_connection.execute(add_menu_query, add_menu_val);

    new_menu_id = add_menu_rows.insertId;

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  req.db_connection.release();

  res.status(201);
  res.json({
    "menu_id": new_menu_id
  });
});

router.put('/:menu_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const menu_id = parseInt(req.params.menu_id, 10);
  if(isNaN(menu_id)) {
    throw createError(400, "'menu_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['menu_id']
    });
  }

  const content = req.body || {};

  const price = parseInt(content['price'], 10);
  if(isNaN(price)) {
    throw createError(400, "'price' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['price']
    });
  }

  const is_enabled = parseInt(content['is_enabled'], 10);
  if(isNaN(is_enabled) || (is_enabled !== 0 && is_enabled !== 1)) {
    throw createError(400, "'is_enabled' must be 0 or 1.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['is_enabled']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const menu_chk_query = "SELECT * FROM `menus` WHERE `id` = ?";
  const menu_chk_val = [menu_id];
  const [menu_chk_rows, menu_chk_fields] = await req.db_connection.execute(menu_chk_query, menu_chk_val);

  if(menu_chk_rows.length === 0) {
    throw createError(404, "Requested 'menu_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['menu_id']
    });
  }

  const group_id = menu_chk_rows[0]['group_id'];

  // 이전 버전에서 role check 누락됨
  const p_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
  const p_chk_val = [group_id, req.user_info['user_id']];
  const [p_chk_rows, p_chk_fields] = await req.db_connection.execute(p_chk_query, p_chk_val);

  if(p_chk_rows.length === 0) {
    throw createError(403, "Not an admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const update_menu_query = "UPDATE `menus` SET `price` = ?, `is_enabled` = ? WHERE `id` = ?";
    const update_menu_val = [price, is_enabled, menu_id];
    await req.db_connection.execute(update_menu_query, update_menu_val);

    if(is_enabled === 0) {
      const get_sm_query = "SELECT * FROM `set_contents` WHERE `menu_id` = ?";
      const get_sm_val = [menu_id];
      const [get_sm_rows, get_sm_fields] = await req.db_connection.execute(get_sm_query, get_sm_val);

      const set_contents = JSON.parse(JSON.stringify(get_sm_rows));
      for(const set_content of set_contents) {
        const update_sm_query = "UPDATE `setmenus` SET `is_enabled` = 0 WHERE `id` = ?";
        const update_sm_val = [set_content['set_id']];
        await req.db_connection.execute(update_sm_query, update_sm_val);
      }
    }

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  req.db_connection.release();

  res.status(200);
  res.json({
    "menu_id": menu_id
  });
});

export default router;