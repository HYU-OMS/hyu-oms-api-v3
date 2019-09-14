"use strict";

const createError = require('http-errors');
const express = require('express');
const asyncify = require('express-asyncify');
const helmet = require('helmet');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const config = require('../../config');

const user_route = require('./routes/user');
const group_route = require('./routes/group');
const member_route = require('./routes/member');
const menu_route = require('./routes/menu');
const setmenu_route = require('./routes/setmenu');
const order_route = require('./routes/order');
const queue_route = require('./routes/queue');
const download_route = require('./routes/download');

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
app.use("/user", user_route);
app.use("/group", group_route);
app.use("/member", member_route);
app.use("/menu", menu_route);
app.use("/setmenu", setmenu_route);
app.use("/order", order_route);
app.use("/queue", queue_route);
app.use("/download", download_route);

// 서버 Alive 체크를 위한 것
app.get("/", async (req, res, next) => {
  res.status(200);
  res.json({
    "version": "3.0"
  });
});

module.exports = app;