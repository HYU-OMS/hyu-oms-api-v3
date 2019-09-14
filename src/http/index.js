"use strict";

const createError = require('http-errors');
const express = require('express');
const asyncify = require('express-asyncify');
const cors = require('cors');
const logger = require('morgan');
const helmet = require('helmet');
const uuidv4 = require('uuid/v4');
const mysql = require('mysql2/promise');
const http = require('http');

const api_v3 = require('./api/v3');
const config = require('../config');

const app = asyncify(express());

/* Development 일 경우 console 에 log 표시 */
if(process.env.NODE_ENV === 'development') {
  app.use(logger('dev'));
}

app.enable("trust proxy");
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// MySQL pool 관련 정보 지정
app.set("mysql_pool", mysql.createPool({
  connectionLimit: config['v3']['mysql']['connection_limit'],
  host: config['v3']['mysql']['host'],
  database: config['v3']['mysql']['database'],
  user: config['v3']['mysql']['user'],
  password: config['v3']['mysql']['password'],
  waitForConnections: config['v3']['mysql']['wait_for_connections']
}));

// DB pool object 를 req object 에 assign 한다.
app.use(async (req, res, next) => {
  req.db_pool = app.get("mysql_pool"); // DB object 가져오기
  next();
});

// DB connection 을 release 하기 위해 Event Listener 등록
app.use(async (req, res, next) => {
  const headers = JSON.stringify(req.headers);
  const client_ip = req.ip;
  const client_forwarded_ips = JSON.stringify(req.ips);
  const http_method = req.method;
  const original_url = req.originalUrl;
  const url_query = JSON.stringify(req.query);
  const req_body = JSON.stringify(req.body);

  const unix_time = parseInt((Math.round(Date.now() / 1000)).toString(), 10);
  const uuid = uuidv4();

  req.log_unix_time = unix_time;
  req.log_uuid = uuid;
  req.is_error = false;

  // response 를 전송하지 못했을 경우.
  res.on('close', async () => {
    try {
      if(Boolean(req.db_connection) !== false) {
        const log_query = "INSERT INTO `logs` SET " +
          "`unix_time` = ?, `uuid` = ?, `is_error` = 1, `headers` = ?, " +
          "`client_ip` = ?, `client_forwarded_ips` = ?, " +
          "`method` = ?, `original_url` = ?, `url_query` = ?, `req_body` = ?";
        const log_val = [unix_time, uuid, headers, client_ip, client_forwarded_ips,
          http_method, original_url, url_query, req_body];
        await req.db_connection.execute(log_query, log_val);

        req.db_connection.destroy();
      }
      else {
        req.db_connection = await req.db_pool.getConnection();

        const log_query = "INSERT INTO `logs` SET " +
          "`unix_time` = ?, `uuid` = ?, `is_error` = 1, `headers` = ?, " +
          "`client_ip` = ?, `client_forwarded_ips` = ?, " +
          "`method` = ?, `original_url` = ?, `url_query` = ?, `req_body` = ?";
        const log_val = [unix_time, uuid, headers, client_ip, client_forwarded_ips,
          http_method, original_url, url_query, req_body];
        await req.db_connection.execute(log_query, log_val);

        req.db_connection.destroy();
      }
    } catch(err) {
      console.error(err.stack);
    }
  });

  // response 가 정상적으로 전송된 경우.
  res.on('finish', async () => {
    try {
      if(Boolean(req.db_connection) !== false) {
        const log_query = "INSERT INTO `logs` SET " +
          "`unix_time` = ?, `uuid` = ?, `is_error` = ?, `headers` = ?, " +
          "`client_ip` = ?, `client_forwarded_ips` = ?, " +
          "`method` = ?, `original_url` = ?, `url_query` = ?, `req_body` = ?";
        const log_val = [unix_time, uuid, (req.is_error === true) ? 1 : 0, headers, client_ip, client_forwarded_ips,
          http_method, original_url, url_query, req_body];
        await req.db_connection.execute(log_query, log_val);

        req.db_connection.release();
      }
    } catch(err) {
      console.error(err.stack);
    }
  });

  next();
});

// HTTP API Version 3
app.use('/v3', api_v3);

// catch 404 and forward to error handler
app.use(async (req, res, next) => {
  next(createError(404, "Requested URI not exists.", {
    state: 'URI_NOT_EXISTS'
  }));
});

// error handler
app.use(async (err, req, res, next) => {
  const status_code = err.status || 500;
  req.is_error = true;

  /* 콘솔에 error 표시 */
  console.error(err.stack);

  // Error Log
  if(Boolean(req.db_connection) !== false) {
    try {
      const err_query = "INSERT INTO `errors` SET `unix_time` = ?, `uuid` = ?, `status_code` = ?, `message` = ?, `stack` = ?";
      const err_val = [req.log_unix_time, req.log_uuid, status_code, err.message, err.stack];
      await req.db_connection.execute(err_query, err_val);
    } catch(err) {
      console.error(err.stack);
    }
  }

  if(parseInt((status_code / 10).toString(), 10) === 50) {
    res.status(status_code);
    res.json({
      message: 'Internal server error',
      state: err.state || undefined,
      stack: err.stack
    });
  }
  else {
    res.status(status_code);
    res.json(err);
  }
});

/* Create HTTP server and export for default module. */
const server = http.createServer(app);
module.exports = server;