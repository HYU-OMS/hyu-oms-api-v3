import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import rp from 'request-promise-native';
import uuidv4 from 'uuid/v4';
import jwt from 'jsonwebtoken';

import config from '../../../config';

const jwt_config = config['v1']['jwt'];
const router = asyncify(express.Router());

router.post('/', async (req, res, next) => {
  // json body를 받는다.
  const content = req.body || {};

  // 로그인 type 을 받는다.
  const auth_type = content['type'];
  if(auth_type === 'facebook') {
    const fb_access_token = content['access_token'];
    if(Boolean(fb_access_token) === false) {
      throw createError(400, "'access_token' must be provided!", {
        state: 'REQUIRED_VALUE_EMPTY_ERR',
        info: ['access_token']
      });
    }

    // Facebook API Server 에 요청을 보내기 위한 옵션
    const options = {
      "method": "GET",
      "uri": "https://graph.facebook.com/v3.2/me",
      "qs": {
        "access_token": fb_access_token,
        "fields": "id,name"
      },
      "resolveWithFullResponse": true
    };

    let profile = undefined;
    try {
      const resp = await rp(options);
      const resp_body = resp['body'];

      profile = JSON.parse(resp_body);
    }
    catch(err) {
      const resp = err['response'];
      const resp_body = JSON.parse(resp['body']);

      const status_code = parseInt(resp['statusCode'], 10) || 500;
      const message = resp_body['error']['message'] || "Facebook API Server Error!";

      throw createError(status_code, message, {
        state: 'FACEBOOK_API_ERR'
      });
    }

    // Facebook 유저 고유번호를 받는다.
    const fb_id = parseInt(profile['id'], 10);

    // TODO: 과연 fb_id 를 못가져오는 일이 있을까?

    // Facebook 유저 이름을 받는다.
    const fb_nick = profile['name'];

    // DB Connection 생성 후 req object에 assign.
    req.db_connection = await req.db_pool.getConnection();

    const user_chk_query = "SELECT * FROM `users` WHERE `fb_id` = ?";
    const user_chk_val = [fb_id];
    let [user_rows, user_fields] = await req.db_connection.execute(user_chk_query, user_chk_val);

    // 없는 유저일 경우 자동으로 회원 가입을 진행한다.
    if(user_rows.length === 0) {
      try {
        await req.db_connection.query("START TRANSACTION");

        const new_user_query = "INSERT INTO `users` SET `name` = ?, `fb_id` = ?";
        const new_user_val = [fb_nick, fb_id];
        await req.db_connection.execute(new_user_query, new_user_val);

        await req.db_connection.query("COMMIT");
      } catch(err) {
        await req.db_connection.query("ROLLBACK");
        throw err;
      }

      [user_rows, user_fields] = await req.db_connection.execute(user_chk_query, user_chk_val);
    }

    const user_data = JSON.parse(JSON.stringify(user_rows[0]));

    if(parseInt(user_data['enabled'], 10) !== 1) {
      throw createError(401, "This account has been disabled. Please contact system administrator!", {
        state: 'USER_DISABLED_ERR'
      });
    }

    // uuid를 생성한 후 유저 정보를 업데이트한다. (중복 로그인 방지)
    const auth_uuid = uuidv4();

    try {
      await req.db_connection.query("START TRANSACTION");

      const update_uuid_query = "UPDATE `users` SET `auth_uuid` = ?, `name` = ?, `updated_at` = ? WHERE `id` = ?";
      const update_uuid_val = [auth_uuid, fb_nick, new Date(new Date().toUTCString()), user_data['id']];
      await req.db_connection.execute(update_uuid_query, update_uuid_val);

      await req.db_connection.query("COMMIT");
    } catch(err) {
      await req.db_connection.query("ROLLBACK");
      throw err;
    }

    const token = jwt.sign({
      "user_id": user_data['id'],
      "user_name": user_data['name'],
      "auth_uuid": auth_uuid
    }, jwt_config['secret_key'], {
      "algorithm": jwt_config['algorithm'],
      "expiresIn": "24h"
    });

    res.status(200);
    res.json({"jwt": token});
  }
  else if(auth_type === 'kakao') {
    const kakao_access_token = content['access_token'];
    if(Boolean(kakao_access_token) === false) {
      throw createError(400, "'access_token' must be provided!", {
        state: 'REQUIRED_VALUE_EMPTY_ERR',
        info: ['access_token']
      });
    }

    // Kakao API Server 에 요청을 보내기 위한 옵션
    const options = {
      "method": "GET",
      "uri": "https://kapi.kakao.com/v2/user/me",
      "headers": {
        "Authorization": "Bearer " + kakao_access_token
      },
      "resolveWithFullResponse": true
    };

    // Kakao 유저 정보를 받아온다.
    let profile = undefined;
    try {
      const resp = await rp(options);
      const resp_body = resp['body'];

      profile = JSON.parse(resp_body);
    } catch(err) {
      const resp = err['response']; // response object 를 받는다.
      const resp_body = JSON.parse(resp['body']); // response body 를 받아 JSON parse 진행한다.

      const status_code = parseInt(resp['statusCode'], 10) || 500;
      const message = resp_body['msg'] || "Kakao API Server Error!";

      throw createError(status_code, message, {
        state: 'KAKAO_API_ERR'
      });
    }

    // Kakao 유저 고유번호를 받는다.
    const kakao_id = parseInt(profile['id'], 10);

    // TODO: 과연 kakao_id 를 못가져오는 일이 있을까?

    // Kakao 유저 닉네임을 받는다.
    const kakao_nick = profile['properties']['nickname'];

    // DB Connection 생성 후 req object에 assign.
    req.db_connection = await req.db_pool.getConnection();

    const user_chk_query = "SELECT * FROM `users` WHERE `kakao_id` = ?";
    const user_chk_val = [kakao_id];
    let [user_rows, user_fields] = await req.db_connection.execute(user_chk_query, user_chk_val);

    // 없는 유저일 경우 자동으로 회원 가입을 진행한다.
    if(user_rows.length === 0) {
      try {
        await req.db_connection.query("START TRANSACTION");

        const new_user_query = "INSERT INTO `users` SET `name` = ?, `kakao_id` = ?";
        const new_user_val = [kakao_nick, kakao_id];
        await req.db_connection.execute(new_user_query, new_user_val);

        await req.db_connection.query("COMMIT");
      } catch(err) {
        await req.db_connection.query("ROLLBACK");
        throw err;
      }

      [user_rows, user_fields] = await req.db_connection.execute(user_chk_query, user_chk_val);
    }

    const user_data = JSON.parse(JSON.stringify(user_rows[0]));

    if(parseInt(user_data['enabled'], 10) !== 1) {
      throw createError(401, "This account has been disabled. Please contact system administrator!", {
        state: 'USER_DISABLED_ERR'
      });
    }

    // uuid를 생성한 후 유저 정보를 업데이트한다. (중복 로그인 방지)
    const auth_uuid = uuidv4();

    try {
      await req.db_connection.query("START TRANSACTION");

      const update_uuid_query = "UPDATE `users` SET `auth_uuid` = ?, `name` = ?, `updated_at` = ? WHERE `id` = ?";
      const update_uuid_val = [auth_uuid, kakao_nick, new Date(new Date().toUTCString()), user_data['id']];
      await req.db_connection.execute(update_uuid_query, update_uuid_val);

      await req.db_connection.query("COMMIT");
    } catch(err) {
      await req.db_connection.query("ROLLBACK");
      throw err;
    }

    const token = jwt.sign({
      "user_id": user_data['id'],
      "user_name": user_data['name'],
      "auth_uuid": auth_uuid
    }, jwt_config['secret_key'], {
      "algorithm": jwt_config['algorithm'],
      "expiresIn": "24h"
    });

    res.status(200);
    res.json({"jwt": token});
  }
  else {
    throw createError(400, "'type' must be 'facebook' or 'kakao'!", {
      state: 'REQUIRED_VALUE_EMPTY_ERR',
      info: ['type']
    });
  }
});

export default router;