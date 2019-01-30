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
import order_controller from './controllers/order';
import queue_controller from './controllers/queue';
import download_controller from './controllers/download';

const app = asyncify(express());

app.use(helmet());

// JWT 존재 시 확인
app.use(async (req, res, next) => {
  if(Boolean(req.get('Authorization')) === true || Boolean(req.query['jwt']) === true) {
    let token = undefined;

    if (Boolean(req.get('Authorization')) === true) {
      const authorization = req.get('Authorization').split(' ');
      if (authorization[0] !== 'Bearer' || authorization.length !== 2) {
        throw createError(400, "'Authorization' must be 'Bearer [token]'.", {
          state: 'AUTH_HEADER_FORMAT_ERR',
          info: ['Authorization']
        });
      }

      token = authorization[1];
    } else {
      token = req.query['jwt'];
    }

    let decoded_token = undefined;
    try {
      decoded_token = jwt.verify(token, config['v1']['jwt']['secret_key']);
    } catch (err) {
      switch (err.name) {
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
app.use("/order", order_controller);
app.use("/queue", queue_controller);
app.use("/download", download_controller);

// 서버 Alive 체크를 위한 것
app.get("/", async (req, res, next) => {
  res.status(200);
  res.json({
    "version": "1.0"
  });
});

export default app;