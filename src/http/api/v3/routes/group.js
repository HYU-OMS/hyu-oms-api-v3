"use strict";

const createError = require('http-errors');
const express = require('express');
const asyncify = require('express-asyncify');

const Pagination = require('../modules/pagination');
const config = require('../../../../config');

const router = asyncify(express.Router());

router.get('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }
  
  let page_r = req.query['page_r'];
  if(Boolean(page_r) === false || isNaN(page_r) || page_r < 1) {
    page_r = 1;
  }

  let page_ur = req.query['page_ur'];
  if(Boolean(page_ur) === false || isNaN(page_ur) || page_ur < 1) {
    page_ur = 1;
  }

  const fetch_q_r = " " +
    "SELECT `g`.`id`, `g`.`name`, `g`.`creator_id`, `g`.`created_at`, `m`.`role` " +
    "FROM `groups` `g` " +
    "JOIN `members` `m` " +
    "ON `g`.`id` = `m`.`group_id` " +
    "WHERE " +
    "`g`.`is_enabled` = 1 AND `m`.`user_id` = ?";
  const count_q_r = " " +
    "SELECT COUNT(`g`.`id`) AS `cnt` " +
    "FROM `groups` `g` " +
    "JOIN `members` `m` " +
    "ON `g`.`id` = `m`.`group_id` " +
    "WHERE " +
    "`g`.`is_enabled` = 1 AND `m`.`user_id` = ?";
  const order_q_r = " ORDER BY `g`.`id` DESC ";

  const fetch_params_r = {
    fetch: [req.user_info['user_id']],
    count: [req.user_info['user_id']]
  };

  const fetch_q_ur = " " +
    "SELECT `g`.`id`, `g`.`name`, `g`.`created_at` " +
    "FROM `groups` `g` " +
    "WHERE `g`.`is_enabled` = 1 AND `g`.`allow_register` = 1 " +
    "AND NOT EXISTS(SELECT * FROM `members` `m` WHERE `m`.`user_id` = ? AND `m`.`group_id` = `g`.`id`)";
  const count_q_ur = " " +
    "SELECT COUNT(`g`.`id`) AS `cnt` " +
    "FROM `groups` `g` " +
    "WHERE `g`.`is_enabled` = 1 AND `g`.`allow_register` = 1 " +
    "AND NOT EXISTS(SELECT * FROM `members` `m` WHERE `m`.`user_id` = ? AND `m`.`group_id` = `g`.`id`)";
  const order_q_ur = " ORDER BY `g`.`id` DESC ";

  const fetch_params_ur = {
    fetch: [req.user_info['user_id']],
    count: [req.user_info['user_id']]
  };

  // DB Connection 생성 후 req object 에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const group_pagination_r = new Pagination(fetch_q_r, count_q_r, order_q_r, page_r, req.db_connection, fetch_params_r);
  const [items_r, paging_r] = await group_pagination_r.getResult();

  const group_pagination_ur = new Pagination(fetch_q_ur, count_q_ur, order_q_ur, page_ur, req.db_connection, fetch_params_ur);
  const [items_ur, paging_ur] = await group_pagination_ur.getResult();

  res.status(200);
  res.json({
    registered: {
      list: items_r,
      pagination: paging_r
    },
    unregistered: {
      list: items_ur,
      pagination: paging_ur
    }
  });
});

router.post('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const content = req.body || {};

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

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  let new_group_id = undefined;
  try {
    await req.db_connection.query("START TRANSACTION");

    const group_add_query = "INSERT INTO `groups` SET `name` = ?, `creator_id` = ?";
    const group_add_val = [name, req.user_info['user_id']];
    const [group_add_results, group_add_fields] = await req.db_connection.execute(group_add_query, group_add_val);

    new_group_id = group_add_results.insertId;

    const member_update_query = "INSERT INTO `members` SET `group_id` = ?, `user_id` = ?, `role` = '3'";
    const member_update_val = [new_group_id, req.user_info['user_id']];
    await req.db_connection.execute(member_update_query, member_update_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(201);
  res.json({
    "group_id": new_group_id
  });
});

//TODO: crypto 관련 이전 코드 제거
router.put('/:group_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const group_id = parseInt(req.params.group_id, 10);
  if(isNaN(group_id)) {
    throw createError(400, "'group_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['group_id']
    });
  }

  const content = req.body || {};

  const allow_register = Boolean(content['allow_register']);

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const group_chk_query = "SELECT * FROM `groups` WHERE `id` = ?";
  const group_chk_val = [group_id];
  const [group_rows, group_fields] = await req.db_connection.execute(group_chk_query, group_chk_val);

  if(group_rows.length === 0 || group_rows[0]['is_enabled'] !== 1) {
    throw createError(404, "Requested 'group_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['group_id']
    });
  }

  if(group_rows[0]['creator_id'] !== req.user_info['user_id']) {
    throw createError(403, "Only creator of this group can update it!", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id', 'user_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const group_update_query = "UPDATE `groups` SET `allow_register` = ?, `updated_at` = ? WHERE `id` = ?";
    const group_update_val = [allow_register, new Date(new Date().toUTCString()), group_id];
    await req.db_connection.execute(group_update_query, group_update_val);

    await req.db_connection.query("COMMIT");
  }
  catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "group_id": group_id,
    "allow_register": allow_register
  });
});

router.delete('/:group_id', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }

  const group_id = parseInt(req.params.group_id, 10);
  if(isNaN(group_id)) {
    throw createError(400, "'group_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['group_id']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const group_chk_query = "SELECT * FROM `groups` WHERE `id` = ?";
  const group_chk_val = [group_id];
  const [group_rows, group_fields] = await req.db_connection.execute(group_chk_query, group_chk_val);

  if(group_rows.length === 0 || group_rows[0]['is_enabled'] !== 1) {
    throw createError(404, "Requested 'group_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['group_id']
    });
  }

  if(group_rows[0]['creator_id'] !== req.user_info['user_id']) {
    throw createError(403, "Only creator of this group can delete it!", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id', 'user_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const group_update_query = "UPDATE `groups` SET `is_enabled` = 0, `updated_at` = ? WHERE `id` = ?";
    const group_update_val = [new Date(new Date().toUTCString()), group_id];
    await req.db_connection.execute(group_update_query, group_update_val);

    const member_delete_query = "DELETE FROM `members` WHERE `group_id` = ?";
    const member_delete_val = [group_id];
    await req.db_connection.execute(member_delete_query, member_delete_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "group_id": group_id
  });
});

module.exports = router;