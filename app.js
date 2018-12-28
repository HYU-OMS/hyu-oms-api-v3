import createError from 'http-errors';
import express from 'express';
import asyncify from 'express-asyncify';
import cors from 'cors';
import helmet from 'helmet';
import serverless from 'serverless-http';

const app = asyncify(express());

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// catch 404 and forward to error handler
app.use(async (req, res, next) => {
  next(createError(404));
});

// error handler
app.use(async (err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // 개발 모드에서 error stack 확인용으로 삽입
  if(req.app.get('env') === "development") {
    console.log(err.stack);
  }

  res.status(err.status || 500);
  res.json({
    "message": res.locals.message,
    "error": res.locals.error
  });
});

// export default app;
export const handler = serverless(app);