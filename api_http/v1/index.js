import express from 'express';
import asyncify from 'express-asyncify';
import helmet from 'helmet';
import mysql from 'serverless-mysql';

import config from '../../config';

import user_controller from './controllers/user';

const app = asyncify(express());

app.use(helmet());

// Serverless MySQL 관련 정보 지정
app.set("mysql", mysql({
  config: {
    host     : config['v1']['mysql']['host'],
    database : config['v1']['mysql']['database'],
    user     : config['v1']['mysql']['user'],
    password : config['v1']['mysql']['password']
  }
}));

// DB object 를 req object 에 assign 한다.
app.use(async (req, res, next) => {
  req.mysql = app.get("mysql"); // DB object 가져오기
  next();
});

// Controllers
app.use("/user", user_controller);

// 서버 Alive 체크를 위한 것
app.get("/", async (req, res, next) => {
  res.set("X-HYU-OMS-API-VERSION", "1.0");
  res.status(204);
  res.end();
});

export default app;