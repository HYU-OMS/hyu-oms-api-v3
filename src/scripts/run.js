/**
 * Module dependencies.
 */

import app from '../app';
import debug from 'debug';
import http from 'http';

import database_setup from './database_setup';
import config from '../config';

/* Set timezone to UTC */
process.env.TZ = 'UTC';

/* MySQL config variable check */
const v1_mysql = config['v1']['mysql'];
if(v1_mysql['host'] === "" || v1_mysql['user'] === "" || v1_mysql['password'] === "" || v1_mysql['database'] === "") {
  const err = new Error("MySQL environment variables are empty. Please set these variables.");
  console.error(err);
  process.exit(-1);
}

/* JWT config variable check */
const v1_jwt = config['v1']['jwt'];
if(v1_jwt['secret_key'] === "") {
  const err = new Error("JWT secret key is empty. Please set this variable.");
  console.error(err);
  process.exit(-1);
}

/* AES config variable check */
const v1_aes = config['v1']['aes'];
if(v1_aes['key'] === "") {
  const err = new Error("AES key is empty. Please set this variable.");
  console.error(err);
  process.exit(-1);
}

// Create tables on database
database_setup()
  .then((result) => {
    // Do nothing
  })
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  });

const debug_on_listen = debug('hyu-oms-api:server');

/**
 * Normalize a port into a number, string, or false.
 */

const normalizePort = (val) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return null;
};

/**
 * Event listener for HTTP server "error" event.
 */

const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

/**
 * Event listener for HTTP server "listening" event.
 */

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug_on_listen('Listening on ' + bind);
};

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);