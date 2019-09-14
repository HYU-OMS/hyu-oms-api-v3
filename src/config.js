"use strict";

/* 반드시 Environment Variable 을 통해서 값을 지정할 수 있도록 한다. */
const config = {
  "v3": {
    "mysql": {
      "host":(process.env.API_V3_MYSQL_HOST || ""),
      "user": (process.env.API_V3_MYSQL_USER || ""),
      "password": (process.env.API_V3_MYSQL_PASSWD || ""),
      "database": (process.env.API_V3_MYSQL_DB || ""),
      "connection_limit": (process.env.API_V3_MYSQL_CONNECTION_LIMIT || 20),
      "wait_for_connections": (process.env.API_V3_WAIT_FOR_CONNECTIONS || false)
    },
    "jwt": {
      "secret_key": (process.env.API_V3_JWT_SECRET_KEY || ""),
      "algorithm": (process.env.API_V3_JWT_ALGORITHM || "HS512")
    },
    "aes": {
      "key": (process.env.API_V3_AES_KEY || "")
    }
  }
};

module.exports = config;