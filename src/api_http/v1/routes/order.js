"use strict";

const createError = require('http-errors');
const express = require('express');
const asyncify = require('express-asyncify');

const Pagination = require('../modules/pagination');

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

  let page = req.query['page'];
  if(Boolean(page) === false || isNaN(page) || page < 1) {
    page = 1;
  }

  let show_only_pending = parseInt(req.query['show_only_pending'], 10);
  if(isNaN(show_only_pending) === false && show_only_pending !== 0) {
    show_only_pending = 1;
  }
  else {
    show_only_pending = 0;
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

  let [items, paging] = [null, null];

  if(show_only_pending === 1) {
    const fetch_q = " SELECT `orders`.`id`, `orders`.`user_id`, `users`.`name`, `orders`.`table_id`, " +
      "`orders`.`total_price`, `orders`.`status`, `orders`.`created_at` FROM `orders` " +
      "JOIN `users` ON `users`.`id` = `orders`.`user_id` " +
      "WHERE `orders`.`group_id` = ? AND `orders`.`status` = 0 ";
    const count_q = " SELECT COUNT(`orders`.`id`) AS `cnt` FROM `orders` " +
      "WHERE `orders`.`group_id` = ? AND `orders`.`status` = 0 ";
    const order_q = " ORDER BY `orders`.`id` ASC ";

    const fetch_params = {
      fetch: [group_id],
      count: [group_id]
    };

    const order_pagination = new Pagination(fetch_q, count_q, order_q, page, req.db_connection, fetch_params);
    [items, paging] = await order_pagination.getResult();
  }
  else {
    const fetch_q = " SELECT `orders`.`id`, `orders`.`user_id`, `users`.`name`, `orders`.`table_id`, " +
      "`orders`.`total_price`, `orders`.`status`, `orders`.`created_at` FROM `orders` " +
      "JOIN `users` ON `users`.`id` = `orders`.`user_id` " +
      "WHERE `orders`.`group_id` = ? ";
    const count_q = " SELECT COUNT(`orders`.`id`) AS `cnt` FROM `orders` " +
      "WHERE `orders`.`group_id` = ? ";
    const order_q = " ORDER BY `orders`.`id` DESC ";

    const fetch_params = {
      fetch: [group_id],
      count: [group_id]
    };

    const order_pagination = new Pagination(fetch_q, count_q, order_q, page, req.db_connection, fetch_params);
    [items, paging] = await order_pagination.getResult();
  }

  res.status(200);
  res.json({
    list: items,
    pagination: paging
  });
});

router.get('/:order_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const order_id = parseInt(req.params.order_id, 10);
  if(isNaN(order_id)) {
    throw createError(400, "'order_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['order_id']
    });
  }

  // DB Connection 생성 후 req object 에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const get_order_query = "SELECT `group_id`, `order_menus`, `order_setmenus` FROM `orders` WHERE `id` = ?";
  const get_order_val = [order_id];
  const [get_order_rows, get_order_fields] = await req.db_connection.execute(get_order_query, get_order_val);

  if(get_order_rows.length === 0) {
    throw createError(404, "Requested 'order_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['order_id']
    });
  }

  const order_data = JSON.parse(JSON.stringify(get_order_rows[0]));
  const group_id = parseInt(get_order_rows[0]['group_id'], 10);

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not a member of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  order_data['order_menus'] = JSON.parse(order_data['order_menus']);
  order_data['order_setmenus'] = JSON.parse(order_data['order_setmenus']);
  order_data['order_id'] = order_id;

  res.status(200);
  res.json(order_data);
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

  // 원래는 숫자였는데 사용자의 요청에 따라 database 에서 data type 을 string 으로 변경하게 됨.
  const table_id = (content['table_id'] || "").toString();
  if(Boolean(table_id) === false) {
    throw createError(400, "'table_id' must be provided!", {
      state: 'REQUIRED_VALUE_EMPTY_ERR',
      info: ['table_id']
    });
  }
  else if(table_id.length > 64) {
    throw createError(400, "Length of 'table_id' must be smaller than 64!", {
      state: 'REQUIRED_VALUE_LENGTH_ERR',
      info: ['table_id']
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

  const setmenu_list = content['setmenu_list'];
  if(Boolean(setmenu_list) === false) {
    throw createError(400, "'setmenu_list' must be provided!", {
      state: 'REQUIRED_VALUE_EMPTY_ERR',
      info: ['setmenu_list']
    });
  }
  else if(Array.isArray(setmenu_list) === false) {
    throw createError(400, "'setmenu_list' must be array.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['setmenu_list']
    });
  }

  if(menu_list.length === 0 && setmenu_list.length === 0) {
    throw createError(400, "Either 'menu_list' or 'setmenu_list' must contains item!", {
      state: 'ITEM_NOT_EXISTS_ERR',
      info: ['menu_list', 'setmenu_list']
    });
  }

  const order_menus = [];
  const order_setmenus = [];

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

  let total_price = 0;

  const get_menu_query = "SELECT `id`, `name`, `price`, `is_enabled` FROM `menus` WHERE `group_id` = ?";
  const get_menu_val = [group_id];
  const [get_menu_rows, get_menu_fields] = await req.db_connection.execute(get_menu_query, get_menu_val);

  const menu_data = JSON.parse(JSON.stringify(get_menu_rows));
  const group_menus = {};
  for(const content of menu_data) {
    const key = (content['id']).toString();
    group_menus[key] = {
      "name": content['name'],
      "price": parseInt(content['price'], 10),
      "is_enabled": parseInt(content['is_enabled'], 10)
    };
  }

  for(const menu_info of menu_list) {
    if('id' in menu_info === false || 'amount' in menu_info === false) {
      throw createError(400, "'menu_list' must contains 'id' and 'amount' key.", {
        state: 'MALFORMED_DATA_ERR',
        info: ['menu_list']
      });
    }

    const key = (menu_info['id']).toString();

    if(key in group_menus === false) {
      throw createError(403, "Requested 'menu_id -> " + key + "' in 'menu_list' is not associated to this group.", {
        state: 'ACCESS_DENIED_ERR',
        info: ['menu_list', 'group_id']
      });
    }

    if(parseInt(group_menus[key]['is_enabled'], 10) === 0) {
      throw createError(403, "Requested 'menu_id -> " + key + "' in 'menu_list' is not available.", {
        state: 'ITEM_NOT_AVAILABLE_ERR',
        info: ['menu_list', 'group_id']
      });
    }

    const amount = parseInt(menu_info['amount'], 10);
    const price = parseInt(group_menus[key]['price'], 10);
    total_price += (amount * price);

    order_menus.push({
      "id": parseInt(key, 10),
      "name": group_menus[key]['name'],
      "amount": amount
    });
  }

  const get_setmenu_query = "SELECT `id`, `name`, `price`, `is_enabled` FROM `setmenus` WHERE `group_id` = ?";
  const get_setmenu_val = [group_id];
  const [get_setmenu_rows, get_setmenu_fields] = await req.db_connection.execute(get_setmenu_query, get_setmenu_val);

  const setmenu_data = JSON.parse(JSON.stringify(get_setmenu_rows));
  const group_setmenus = {};
  for(const content of setmenu_data) {
    const key = (content['id']).toString();
    group_setmenus[key] = {
      "name": content['name'],
      "price": parseInt(content['price'], 10),
      "is_enabled": parseInt(content['is_enabled'], 10)
    }
  }

  for(const setmenu_info of setmenu_list) {
    if('id' in setmenu_info === false || 'amount' in setmenu_info === false) {
      throw createError(400, "'setmenu_info' must contains 'id' and 'amount' key.", {
        state: 'MALFORMED_DATA_ERR',
        info: ['setmenu_info']
      });
    }

    const key = (setmenu_info['id']).toString();

    if(key in group_setmenus === false) {
      throw createError(403, "Requested 'setmenu_id -> " + key + "' in 'setmenu_list' is not associated to this group.", {
        state: 'ACCESS_DENIED_ERR',
        info: ['setmenu_list', 'group_id']
      });
    }

    if(parseInt(group_setmenus[key]['is_enabled'], 10) === 0) {
      throw createError(403, "Requested 'setmenu_id -> " + key + "' in 'setmenu_list' is not available.", {
        state: 'ITEM_NOT_AVAILABLE_ERR',
        info: ['setmenu_list', 'group_id']
      });
    }

    const amount = parseInt(setmenu_info['amount'], 10);
    const price = parseInt(group_setmenus[key]['price'], 10);
    total_price += (amount * price);

    order_setmenus.push({
      "id": parseInt(key, 10),
      "name": group_setmenus[key]['name'],
      "amount": amount
    });
  }

  let new_order_id = undefined;
  try {
    await req.db_connection.query("START TRANSACTION");

    const add_order_query = "INSERT INTO `orders` SET `user_id` = ?, `group_id` = ?, `table_id` = ?, " +
      "`total_price` = ?, `order_menus` = ?, `order_setmenus` = ?";
    const add_order_val = [req.user_info['user_id'], group_id, table_id, total_price,
      JSON.stringify(order_menus), JSON.stringify(order_setmenus)];
    const [add_order_rows, add_order_fields] = await req.db_connection.execute(add_order_query, add_order_val);

    new_order_id = add_order_rows.insertId;

    const add_order_trans_query = "INSERT INTO `order_transactions` SET " +
      "`order_id` = ?, `menu_id` = ?, `group_id` = ?, `amount` = ?";
    for(const content of menu_list) {
      const add_order_trans_val = [new_order_id, content['id'], group_id, content['amount']];
      await req.db_connection.execute(add_order_trans_query, add_order_trans_val);
    }

    for(const content of setmenu_list) {
      const set_id = parseInt(content['id'], 10);
      const set_amount = parseInt(content['amount'], 10);

      const get_set_query = "SELECT * FROM `set_contents` WHERE `set_id` = ?";
      const get_set_val = [set_id];
      const [get_set_rows, get_set_fields] = await req.db_connection.execute(get_set_query, get_set_val);

      const set_data = JSON.parse(JSON.stringify(get_set_rows));

      for(const each_data of set_data) {
        const menu_id = parseInt(each_data['menu_id'], 10);
        const menu_amount = parseInt(each_data['amount'], 10);

        const chk_trans_query = "SELECT * FROM `order_transactions` " +
          "WHERE `order_id` = ? AND `menu_id` = ? AND `group_id` = ?";
        const chk_trans_val = [new_order_id, menu_id, group_id];
        const [chk_trans_rows, chk_trans_fields] = await req.db_connection.execute(chk_trans_query, chk_trans_val);

        if(chk_trans_rows.length === 0) {
          const add_trans_query = "INSERT INTO `order_transactions` SET " +
            "`order_id` = ?, `menu_id` = ?, `group_id` = ?, `amount` = ?";
          const add_trans_val = [new_order_id, menu_id, group_id, menu_amount * set_amount];
          await req.db_connection.execute(add_trans_query, add_trans_val);
        }
        else {
          const update_trans_query = "UPDATE `order_transactions` SET `amount` = `amount` + ?, `updated_at` = ? " +
            "WHERE `order_id` = ? AND `menu_id` = ? AND `group_id` = ?";
          const update_trans_val = [menu_amount * set_amount, new Date(new Date().toUTCString()), new_order_id, menu_id, group_id];
          await req.db_connection.execute(update_trans_query, update_trans_val);
        }
      }
    }

    const update_other_query = "UPDATE `order_transactions` SET `table_id` = ?, `updated_at` = ? WHERE `order_id` = ?";
    const update_other_val = [table_id, new Date(new Date().toUTCString()), new_order_id];
    await req.db_connection.execute(update_other_query, update_other_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(201);
  res.json({
    "order_id": new_order_id,
    "total_price": total_price
  });
});

router.put('/:order_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const order_id = parseInt(req.params.order_id, 10);
  if(isNaN(order_id)) {
    throw createError(400, "'order_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['order_id']
    });
  }

  const content = req.body || {};

  const is_approved = parseInt(content['is_approved'], 10);
  if(isNaN(is_approved) || (is_approved !== 0 && is_approved !== 1)) {
    throw createError(400, "'is_approved' must be integer and must be 0 or 1.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['is_approved']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const get_order_query = "SELECT * FROM `orders` WHERE `id` = ?";
  const get_order_val = [order_id];
  const [get_order_rows, get_order_fields] = await req.db_connection.execute(get_order_query, get_order_val);

  if(get_order_rows.length === 0) {
    throw createError(404, "Requested 'order_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['order_id']
    });
  }

  if(parseInt(get_order_rows[0]['status'], 10) !== 0) {
    throw createError(403, "This 'order_id' is already processed.", {
      state: 'ALREADY_PROCESSED_ERR',
      info: ['order_id']
    });
  }

  const group_id = parseInt(get_order_rows[0]['group_id'], 10);
  const table_name = get_order_rows[0]['table_id'];

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` > 0";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not an operator of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['order_id']
    });
  }

  const order_status = (is_approved === 1) ? 1 : -1;

  try {
    await req.db_connection.query("START TRANSACTION");

    const update_order_query = "UPDATE `orders` SET `status` = ?, `updated_at` = ? WHERE `id` = ?";
    const update_order_val = [order_status, new Date(new Date().toUTCString()), order_id];
    await req.db_connection.execute(update_order_query, update_order_val);

    const update_order_trans_query = "UPDATE `order_transactions` SET `is_approved` = ?, `updated_at` = ? " +
      "WHERE `order_id` = ?";
    const update_order_trans_val = [is_approved, new Date(new Date().toUTCString()), order_id];
    await req.db_connection.execute(update_order_trans_query, update_order_trans_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "order_id": order_id,
    "is_approved": is_approved
  });
});

module.exports = router;