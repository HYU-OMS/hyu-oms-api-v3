/**
 * Module dependencies.
 */

import app from '../app';
import debug from 'debug';
import http from 'http';
import SocketIO from 'socket.io';
import socket_io_functions from '../api_http/v1/socket_io_functions';

/* Set timezone to UTC */
process.env.TZ = 'UTC';

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
 * Create HTTP server and SocketIO
 */

const server = http.createServer(app);
const io = new SocketIO(server);

io.on('connection', socket_io_functions);
app.set('io', io);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);