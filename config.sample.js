const config = {
  "v1": {
    "mysql": {
      "host":(process.env.API_V1_MYSQL_HOST || "localhost"),
      "user": (process.env.API_V1_MYSQL_USER || ""),
      "password": (process.env.API_V1_MYSQL_PASSWD || ""),
      "database": (process.env.API_V1_MYSQL_DB || "hyu-oms")
    },
    "jwt": {
      "secret_key": (process.env.API_V1_JWT_SECRET_KEY || "USE_YOUR_SECRET_KEY"),
      "algorithm": (process.env.API_V1_JWT_ALGORITHM || "HS512")
    }
  }
};

export default config;