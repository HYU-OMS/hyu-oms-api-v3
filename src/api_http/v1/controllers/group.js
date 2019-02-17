import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import crypto from 'crypto';

import Pagination from '../modules/pagination';
import config from '../../../config';

const router = asyncify(express.Router());

router.get('/', async (req, res, next) => {
  if(Boolean(req.user_info) === false) {
    throw createError(401, "JWT must be provided!", {
      state: 'AUTH_HEADER_EMPTY_ERR',
      info: ['Authorization']
    });
  }
  
  let page = req.query['page'];
  if(Boolean(page) === false || isNaN(page) || page < 1) {
    page = 1;
  }
  
  const fetch_q = " SELECT `groups`.`id`, `groups`.`name`, `groups`.`creator_id`, " +
    "`groups`.`signup_code`, `groups`.`created_at`, `members`.`role` FROM `groups` " +
    "JOIN `members` ON `groups`.`id` = `members`.`group_id` " +
    "WHERE `members`.`user_id` = ? AND `groups`.`is_enabled` = 1 ";
  const count_q = " SELECT COUNT(`groups`.`id`) AS `cnt` FROM `groups` " +
    "JOIN `members` ON `groups`.`id` = `members`.`group_id` " +
    "WHERE `members`.`user_id` = ? ";
  const order_q = " ORDER BY `groups`.`id` ASC ";
  
  const fetch_params = {
    fetch: [req.user_info['user_id']],
    count: [req.user_info['user_id']]
  };

  // DB Connection 생성 후 req object 에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const group_pagination = new Pagination(fetch_q, count_q, order_q, page, req.db_connection, fetch_params);
  const [items, paging] = await group_pagination.getResult();

  // Signup code 복호화
  const decipher = crypto.createDecipher('aes-256-cbc', config['v1']['aes']['key']);
  for(const item of items) {
    if(item['signup_code'] !== null) {
      let signup_code = decipher.update(item['signup_code'], 'base64', 'utf-8');
      signup_code += decipher.final('utf-8');

      item['signup_code'] = signup_code;
    }
  }
  
  res.status(200);
  res.json({
    list: items,
    pagination: paging
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

    const member_update_query = "INSERT INTO `members` SET `group_id` = ?, `user_id` = ?, `role` = '2'";
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

  let signup_code = null;
  if(Boolean(content['code']) === true) {
    signup_code = content['code'];

    const cipher = crypto.createCipher('aes-256-cbc', config['v1']['aes']['key']);
    signup_code = cipher.update(signup_code, 'utf8', 'base64');
    signup_code += cipher.final('base64');
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
    throw createError(403, "Only creator of this group can update signup code!", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id', 'user_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const group_update_query = "UPDATE `groups` SET `signup_code` = ?, `updated_at` = ? WHERE `id` = ?";
    const group_update_val = [signup_code, new Date(), group_id];
    await req.db_connection.execute(group_update_query, group_update_val);

    await req.db_connection.query("COMMIT");
  }
  catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  if(signup_code !== null) {
    const decipher = crypto.createDecipher('aes-256-cbc', config['v1']['aes']['key']);
    signup_code = decipher.update(signup_code, 'base64', 'utf-8');
    signup_code += decipher.final('utf-8');
  }

  res.status(200);
  res.json({
    "group_id": group_id,
    "code": signup_code
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
    const group_update_val = [new Date(), group_id];
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

export default router;