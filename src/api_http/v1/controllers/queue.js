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

  // DB Connection 생성 후 req object 에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not a member of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  const get_menu_query = "SELECT `id`, `name` FROM `menus` WHERE `group_id` = ?";
  const get_menu_val = [group_id];
  const [get_menu_rows, get_menu_fields] = await req.db_connection.execute(get_menu_query, get_menu_val);

  const menu_list = JSON.parse(JSON.stringify(get_menu_rows));

  const get_trans_query = "SELECT `order_id`, `menu_id`, `table_id`, `amount`, `created_at` " +
    "FROM `order_transactions` WHERE `group_id` = ? AND `is_approved` = 1 AND `is_delivered` = 0";
  const get_trans_val = [group_id];
  const [get_trans_rows, get_trans_fields] = await req.db_connection.execute(get_trans_query, get_trans_val);

  const queue_data = JSON.parse(JSON.stringify(get_trans_rows));
  const queue_list = {};

  for(const each_menu of menu_list) {
    queue_list[(each_menu['id']).toString()] = [];
  }

  for(const each_queue_data of queue_data) {
    queue_list[(each_queue_data['menu_id']).toString()].push(each_queue_data);
  }

  // TODO: shallow copy 인데 문제는 없을까?
  const combined_queue_list = menu_list;
  for(const each_menu of combined_queue_list) {
    each_menu['queue'] = queue_list[(each_menu['id']).toString()];
  }

  res.status(200);
  res.json(combined_queue_list);
});

router.put('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const content = req.body || {};

  const order_id = parseInt(content['order_id'], 10);
  if(isNaN(order_id)) {
    throw createError(400, "'order_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['order_id']
    });
  }

  const menu_id = parseInt(content['menu_id'], 10);
  if(isNaN(menu_id)) {
    throw createError(400, "'menu_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['menu_id']
    });
  }

  // DB Connection 생성 후 req object 에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const chk_queue_query = "SELECT * FROM `order_transactions` WHERE `order_id` = ? AND `menu_id` = ?";
  const chk_queue_val = [order_id, menu_id];
  const [chk_queue_rows, chk_queue_fields] = await req.db_connection.execute(chk_queue_query, chk_queue_val);

  if(chk_queue_rows.length === 0) {
    throw createError(404, "Requested combination of 'order_id'and 'menu_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['order_id', 'menu_id']
    });
  }

  const group_id = parseInt(chk_queue_rows[0]['group_id'], 10);

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` > 0";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not an operator of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['order_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const update_trans_query = "UPDATE `order_transactions` SET `is_delivered` = 1 " +
      "WHERE `order_id` = ? AND `menu_id` = ?";
    const update_trans_val = [order_id, menu_id];
    await req.db_connection.execute(update_trans_query, update_trans_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "order_id": order_id,
    "menu_id": menu_id
  });

  const get_order_query = "SELECT * FROM `orders` WHERE `id` = ?";
  const get_order_val = [order_id];
  const [get_order_rows, get_order_fields] = await req.db_connection.execute(get_order_query, get_order_val);

  const table_name = get_order_rows[0]['table_id'];

  const menu_chk_query = "SELECT * FROM `menus` WHERE `id` = ?";
  const menu_chk_val = [menu_id];
  const [menu_chk_rows, menu_chk_fields] = await req.db_connection.execute(menu_chk_query, menu_chk_val);

  const menu_name = menu_chk_rows[0]['name'];

  // Socket.IO emit
  const io = req.io;
  const room_name = "group_" + group_id.toString();
  const data = {
    "order_id": order_id,
    "table_name": table_name,
    "menu_name": menu_name
  };

  io.volatile.to(room_name).emit('queue_removed', data);
});

export default router;