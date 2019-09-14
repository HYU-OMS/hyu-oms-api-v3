"use strict";

const createError = require('http-errors');
const express = require('express');
const asyncify = require('express-asyncify');
const crypto = require('crypto');

const config = require('../../../../config');

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

  const permission_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const permission_chk_val = [group_id, req.user_info['user_id']];
  const [pchk_rows, pchk_fields] = await req.db_connection.execute(permission_chk_query, permission_chk_val);

  if(pchk_rows.length === 0) {
    throw createError(403, "Not a member of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  const member_chk_query = "SELECT `users`.`name`, `users`.`id`, `members`.`role` FROM `members` " +
    "JOIN `users` ON `users`.`id` = `members`.`user_id` " +
    "WHERE `members`.`group_id` = ? " +
    "ORDER BY `users`.`id` ASC";
  const member_chk_val = [group_id];
  const [member_rows, member_fields] = await req.db_connection.execute(member_chk_query, member_chk_val);

  const members = JSON.parse(JSON.stringify(member_rows));

  res.status(200);
  res.json(members);
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

  const signup_code_requested = content['code'] || null;

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const group_chk_query = "SELECT * FROM `groups` WHERE `id` = ? AND `is_enabled` = 1";
  const group_chk_val = [group_id];
  const [group_chk_rows, group_chk_fields] = await req.db_connection.execute(group_chk_query, group_chk_val);

  if(group_chk_rows.length === 0) {
    throw createError(404, "Requested 'group_id' not found.", {
      state: 'DATA_NOT_FOUND_ERR',
      info: ['group_id']
    });
  }

  let signup_code_in_database = group_chk_rows[0]['signup_code'];
  if(Boolean(signup_code_in_database) === false) {
    throw createError(403, "Sign-up is currently disabled for this group.", {
      state: 'SIGNUP_DISABLED_ERR',
      info: ['group_id']
    });
  }

  const decipher = crypto.createDecipher('aes-256-cbc', config['v3']['aes']['key']);
  signup_code_in_database = decipher.update(signup_code_in_database, 'base64', 'utf-8');
  signup_code_in_database += decipher.final('utf-8');

  if(signup_code_in_database !== signup_code_requested) {
    throw createError(403, "Invalid code for this 'group_id'", {
      state: 'INVALID_CODE_ERR',
      info: ['group_id', 'code']
    });
  }

  const member_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const member_chk_val = [group_id, req.user_info['user_id']];
  const [member_rows, member_fields] = await req.db_connection.execute(member_chk_query, member_chk_val);

  if(member_rows.length !== 0) {
    throw createError(403, "Existing member in this group.", {
      state: 'EXISTING_MEMBER_ERR',
      info: ['group_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const member_add_query = "INSERT INTO `members` SET `group_id` = ?, `user_id` = ?, `role` = 0";
    const member_add_val = [group_id, req.user_info['user_id']];
    await req.db_connection.execute(member_add_query, member_add_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "group_id": group_id,
    "user_id": req.user_info['user_id']
  });
});

router.put('/', async (req, res, next) => {
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

  const user_id = parseInt(content['user_id'], 10);
  if(isNaN(user_id)) {
    throw createError(400, "'user_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['user_id']
    });
  }

  const role = parseInt(content['role'], 10);
  if(isNaN(role) || (role < 0 || role > 2)) {
    throw createError(400, "'role' must be 0 or 1 or 2.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['role']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const chk_p_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
  const chk_p_val = [group_id, req.user_info['user_id']];
  const [chk_p_rows, chk_p_fields] = await req.db_connection.execute(chk_p_query, chk_p_val);

  if(chk_p_rows.length === 0) {
    throw createError(403, "Not an admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  const chk_user_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const chk_user_val = [group_id, user_id];
  const [chk_user_rows, chk_user_fields] = await req.db_connection.execute(chk_user_query, chk_user_val);

  if(chk_user_rows.length === 0) {
    throw createError(403, "Not a member in this group.", {
      state: 'NOT_A_MEMBER_ERR',
      info: ['group_id', 'user_id']
    });
  }

  const chk_creator_query = "SELECT * FROM `groups` WHERE `id` = ? AND `creator_id` = ?";
  const chk_creator_val = [group_id, user_id];
  const [chk_creator_rows, chk_creator_fields] = await req.db_connection.execute(chk_creator_query, chk_creator_val);

  if(chk_creator_rows.length !== 0) {
    throw createError(403, "Unable to change creator's role.", {
      state: 'CREATOR_ROLE_CHANGE_DENIED_ERR',
      info: ['group_id', 'user_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const update_member_query = "UPDATE `members` SET `role` = ?, `updated_at` = ? WHERE `group_id` = ? AND `user_id` = ?";
    const update_member_val = [role, new Date(new Date().toUTCString()), group_id, user_id];
    await req.db_connection.execute(update_member_query, update_member_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "group_id": group_id,
    "user_id": user_id,
    "role": role
  });
});

router.delete('/', async (req, res, next) => {
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

  const user_id = parseInt(req.query['user_id'], 10);
  if(isNaN(user_id)) {
    throw createError(400, "'user_id' must be integer.", {
      state: 'REQUIRED_VALUE_INVALID_ERR',
      info: ['user_id']
    });
  }

  // DB Connection 생성 후 req object에 assign.
  req.db_connection = await req.db_pool.getConnection();

  const p_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ? AND `role` = 2";
  const p_chk_val = [group_id, req.user_info['user_id']];
  const [p_chk_rows, p_chk_fields] = await req.db_connection.execute(p_chk_query, p_chk_val);

  if(p_chk_rows.length === 0) {
    throw createError(403, "Not an admin of this group.", {
      state: 'ACCESS_DENIED_ERR',
      info: ['group_id']
    });
  }

  const member_chk_query = "SELECT * FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
  const member_chk_val = [group_id, user_id];
  const [member_chk_rows, member_chk_fields] = await req.db_connection.execute(member_chk_query, member_chk_val);

  if(member_chk_rows.length === 0) {
    throw createError(403, "Not a member in this group.", {
      state: 'NOT_A_MEMBER_ERR',
      info: ['group_id', 'user_id']
    });
  }

  const chk_creator_query = "SELECT * FROM `groups` WHERE `id` = ? AND `creator_id` = ?";
  const chk_creator_val = [group_id, user_id];
  const [chk_creator_rows, chk_creator_fields] = await req.db_connection.execute(chk_creator_query, chk_creator_val);

  if(chk_creator_rows.length !== 0) {
    throw createError(403, "Unable to delete creator.", {
      state: 'CREATOR_ROLE_DELETE_DENIED_ERR',
      info: ['group_id', 'user_id']
    });
  }

  try {
    await req.db_connection.query("START TRANSACTION");

    const del_member_query = "DELETE FROM `members` WHERE `group_id` = ? AND `user_id` = ?";
    const del_member_val = [group_id, user_id];
    await req.db_connection.execute(del_member_query, del_member_val);

    await req.db_connection.query("COMMIT");
  } catch(err) {
    await req.db_connection.query("ROLLBACK");
    throw err;
  }

  res.status(200);
  res.json({
    "group_id": group_id,
    "user_id": user_id
  });
});

module.exports = router;