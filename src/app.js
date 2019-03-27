import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import cors from 'cors';
import logger from 'morgan';
import helmet from 'helmet';

import http_api_v1 from './api_http/v1';
import mysql from "mysql2/promise";
import config from "./config";

const app = asyncify(express());

/* Development 일 경우 console 에 log 표시 */
if(process.env.NODE_ENV === 'development') {
  app.use(logger('dev'));
}

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// MySQL pool 관련 정보 지정
app.set("mysql_pool", mysql.createPool({
  connectionLimit: config['v1']['mysql']['connection_limit'],
  host: config['v1']['mysql']['host'],
  database: config['v1']['mysql']['database'],
  user: config['v1']['mysql']['user'],
  password: config['v1']['mysql']['password'],
  waitForConnections: config['v1']['mysql']['wait_for_connections']
}));

// DB pool object 를 req object 에 assign 한다.
app.use(async (req, res, next) => {
  req.db_pool = app.get("mysql_pool"); // DB object 가져오기
  next();
});

// DB connection 을 release 하기 위해 Event Listener 등록
app.use(async (req, res, next) => {
  // response 를 전송하지 못했을 경우.
  res.on('close', async () => {
    if(Boolean(req.db_connection) !== false) {
      req.db_connection.destroy();
    }
  });

  // response 가 정상적으로 전송된 경우.
  res.on('finish', async () => {
    if(Boolean(req.db_connection) !== false) {
      req.db_connection.release();
    }
  });

  next();
});

// HTTP API Version 1
app.use('/v1', http_api_v1);

// catch 404 and forward to error handler
app.use(async (req, res, next) => {
  next(createError(404, "Requested URI not exists.", {
    state: 'URI_NOT_EXISTS'
  }));
});

// error handler
app.use(async (err, req, res, next) => {
  const status_code = err.status || 500;

  // 혹시 연결이 남아있을수도 있으므로 destroy 를 진행. (이렇게 하는게 맞나?)
  if(Boolean(req.db_connection) !== false) {
    req.db_connection.destroy();
  }

  /* Development 일 경우 console 과 response 에 error 표시 */
  let err_stack = undefined;
  if(process.env.NODE_ENV === 'development') {
    err_stack = err.stack;
    console.log(err_stack);
  }

  if(parseInt((status_code / 10).toString(), 10) === 50) {
    res.status(status_code);
    res.json({
      message: 'Internal server error',
      state: err.state || undefined,
      stack: err_stack
    });
  }
  else {
    res.status(status_code);
    res.json(err);
  }
});

export default app;