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

  const chk_setmenu_query = "SELECT `id`, `name`, `price`, `is_enabled` FROM `setmenus` WHERE `group_id` = ?";
  const chk_setmenu_val = [group_id];
  const [chk_setmenu_rows, chk_setmenu_fields] = await req.db_connection.execute(chk_setmenu_query, chk_setmenu_val);

  const setmenus = JSON.parse(JSON.stringify(chk_setmenu_rows));

  for(const setmenu of setmenus) {
    const get_setinfo_query = "SELECT `menus`.`id`, `menus`.`name`, `set_contents`.`amount` FROM `menus` " +
      "JOIN `set_contents` ON `menus`.`id` = `set_contents`.`menu_id` " +
      "WHERE `menus`.`id` = ANY(SELECT `menu_id` FROM `set_contents` WHERE `set_id` = ?) " +
      "AND `set_contents`.`set_id` = ?";
    const get_setinfo_val = [setmenu['id'], setmenu['id']];
    const [get_setinfo_rows, get_setinfo_fields] = await req.db_connection.execute(get_setinfo_query, get_setinfo_val);

    // const menu_list = JSON.parse(JSON.stringify(get_setinfo_rows));
    // setmenu['menu_list'] = menu_list;
    setmenu['menu_list'] = JSON.parse(JSON.stringify(get_setinfo_rows));
  }

  req.db_connection.release();

  res.status(200);
  res.json(setmenus);
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

  const menu_list = content['menu_list'];
  if(Boolean(menu_list) === false) {
    throw createError(400, "'menu_list' must be provided!", {
      state: 'REQUIRED_VALUE_EMPTY_ERR',
      info: ['menu_list']
    });
  }
  else if(Array.isArray(menu_list) === false) {
    throw createError(400, "'menu_list' must be array.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['menu_list']
    });
  }
  else if(menu_list.length === 0) {
    throw createError(400, "'menu_list' must contains item!", {
      state: 'ITEM_NOT_EXISTS_ERR',
      info: ['menu_list']
    });
  }

  const set_content = {};
  for(const menu_id of menu_list) {
    if(isNaN(menu_id) === true) {
      throw createError(400, "'menu_list' only accepts integer!", {
        state: 'INVALID_ITEM_EXISTS_ERR',
        info: ['menu_list']
      });
    }
    else {
      const key = menu_id.toString();
      if(key in set_content) {
        set_content[key] += 1;
      }
      else {
        set_content[key] = 1;
      }
    }
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0 || parseInt(chk_p_rows[0]['role'], 10) < 2) {
    throw createError(403, "Not a admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  for(const menu_id of menu_list) {
    const menu_chk_query = "SELECT * FROM `menus` WHERE `id` = ? AND `group_id` = ?";
    const menu_chk_val = [menu_id, group_id];
    const [menu_chk_rows, menu_chk_fields] = await req.db_connection.execute(menu_chk_query, menu_chk_val);

    if(menu_chk_rows.length === 0) {
      throw createError(403, "Invalid 'menu_id' for this group.", {
        state: 'INVALID_DATA_ERR',
        info: ['menu_list']
      });
    }
  }

  let new_setmenu_id = undefined;
  try {
    await req.db_connection.query("START TRANSACTION");

    const set_add_query = "INSERT INTO `setmenus` SET `name` = ?, `price` = ?, `group_id` = ?";
    const set_add_val = [name, price, group_id];
    const [set_add_rows, set_add_fields] = await req.db_connection.execute(set_add_query, set_add_val);

    new_setmenu_id = set_add_rows.insertId;

    for(const key of Object.keys(set_content)) {
      const set_content_add_query = "INSERT INTO `set_contents` SET `set_id` = ?, `menu_id` = ?, `amount` = ?";
      const set_content_add_val = [new_setmenu_id, key, set_content[key]];
      await req.db_connection.execute(set_content_add_query, set_content_add_val);
    }

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  req.db_connection.release();

  res.status(201);
  res.json({
    "setmenu_id": new_setmenu_id
  });
});

router.put('/:setmenu_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const setmenu_id = parseInt(req.params.setmenu_id, 10);
  if(isNaN(setmenu_id)) {
    throw createError(400, "'setmenu_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['setmenu_id']
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

  const setmenu_chk_query = "SELECT * FROM `setmenus` WHERE `id` = ?";
  const setmenu_chk_val = [setmenu_id];
  const [setmenu_chk_rows, setmenu_chk_fields] = await req.db_connection.execute(setmenu_chk_query, setmenu_chk_val);

  if(setmenu_chk_rows.length === 0) {
    throw createError(404, "Requested 'setmenu_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['setmenu_id']
    });
  }

  const group_id = setmenu_chk_rows[0]['group_id'];

  // 이전 버전에서 role check 누락됨
  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not an admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const update_set_query = "UPDATE `setmenus` SET `price` = ?, `is_enabled` = ? WHERE `id` = ?";
    const update_set_val = [price, is_enabled, setmenu_id];
    await req.db_connection.execute(update_set_query, update_set_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "setmenu_id": setmenu_id
  });
});

export default router;