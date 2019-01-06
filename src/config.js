/* 반드시 Environment Variable 을 통해서 값을 지정할 수 있도록 한다. */
const config = {
  "v1": {
    "mysql": {
      "host":(process.env.API_V1_MYSQL_HOST || "localhost"),
      "user": (process.env.API_V1_MYSQL_USER || "hyu-oms"),
      "password": (process.env.API_V1_MYSQL_PASSWD || "my-secret-password-12345A!"),
      "database": (process.env.API_V1_MYSQL_DB || "hyu-oms"),
      "connection_limit": (process.env.API_V1_MYSQL_CONNECTION_LIMIT || 20)
    },
    "jwt": {
      "secret_key": (process.env.API_V1_JWT_SECRET_KEY || "USE_YOUR_SECRET_KEY"),
      "algorithm": (process.env.API_V1_JWT_ALGORITHM || "HS512")
    },
    "aes": {
      "key": (process.env.API_V1_AES_KEY || "USE_YOUR_AES_KEY")
    }
  }
};

export default config;