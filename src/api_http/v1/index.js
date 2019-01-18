import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import helmet from 'helmet';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

import config from '../../config';

import user_controller from './controllers/user';
import group_controller from './controllers/group';
import member_controller from './controllers/member';
import menu_controller from './controllers/menu';
import setmenu_controller from './controllers/setmenu';

const app = asyncify(express());

app.use(helmet());

// MySQL pool 관련 정보 지정
app.set("mysql_pool", mysql.createPool({
  connectionLimit: config['v1']['mysql']['connection_limit'],
  host: config['v1']['mysql']['host'],
  database: config['v1']['mysql']['database'],
  user: config['v1']['mysql']['user'],
  password: config['v1']['mysql']['password']
}));

// DB pool object 를 req object 에 assign 한다.
app.use(async (req, res, next) => {
  req.db_pool = app.get("mysql_pool"); // DB object 가져오기
  next();
});

// JWT 존재 시 확인
app.use(async (req, res, next) => {
  let authorization = req.get('Authorization');
  if(Boolean(authorization) === true) {
    authorization = authorization.split(' ');
    if(authorization[0] !== 'Bearer' || authorization.length !== 2) {
      throw createError(400, "'Authorization' must be 'Bearer [token]'.", {
        state: 'AUTH_HEADER_FORMAT_ERR',
        info: ['Authorization']
      });
    }

    let decoded_token = undefined;
    try {
      decoded_token = jwt.verify(authorization[1], config['v1']['jwt']['secret_key']);
    }
    catch(err) {
      switch(err.name) {
        case 'TokenExpiredError':
          throw createError(400, err.message, {
            state: 'JWT_EXPIRED_ERR',
            info: ['Authorization']
          });

        case 'JsonWebTokenError':
          throw createError(400, err.message, {
            state: 'JWT_VERIFY_ERR',
            info: ['Authorization']
          });

        default:
          throw err;
      }
    }

    // TODO: auth_uuid valid check

    req.user_info = decoded_token;
  }

  next();
});

// Controllers
app.use("/user", user_controller);
app.use("/group", group_controller);
app.use("/member", member_controller);
app.use("/menu", menu_controller);
app.use("/setmenu", setmenu_controller);

// 서버 Alive 체크를 위한 것
app.get("/", async (req, res, next) => {
  res.status(200);
  res.json({
    "version": "1.0"
  });
});

export default app;