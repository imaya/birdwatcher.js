//-----------------------------------------------------------------------------
// require
//-----------------------------------------------------------------------------
var config = require('./config.js');
var http = require('http');
var fs = require('fs');
var socketIo = require('socket.io');

//-----------------------------------------------------------------------------
// http
//-----------------------------------------------------------------------------
var server = http.createServer(function(req, res) {
  var read;
  var msg;
  var obj;
  var param;

  // default header
  res.writeHeader(200, {'Content-Type': 'text/html'});

  // data
  if (req.url.indexOf('/?') === 0) {
    try {
      param = req.url.substring(2).split('&', 2);
      msg = unescape(param[1]);
      try {
        obj = JSON.parse(msg);
        if (typeof obj.id !== 'string' || typeof obj.data !== 'object') {
          throw new Error('invalid json');
        }

        // update channel list
        updateChannel(obj.id);

        // update log data
        io.sockets.in(obj.id).emit('update', obj.data)
      } catch(e) {
        console.error("invalid json:", msg);
      }
    } finally {
      res.writeHeader(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*'
      });
      res.end();
    }
  // resource
  } else {
    switch (req.url) {
      case '/birdsociety.js':
      case '/smoothie.js':
      case '/main.js':
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        read = fs.createReadStream(__dirname + '/../monitor' + req.url);
        break;
      default:
        read = fs.createReadStream(__dirname + '/../monitor/index.html');
        break;
    }

    // I/O event
    read.on('error', function(err){
      res.end(err.stack);
    });
    read.on('data', function(data){
      res.write(data);
    });
    read.on('end', function() {
      res.end();
    });
  }
});
server.listen(config.Port);

//-----------------------------------------------------------------------------
// socket.io
//-----------------------------------------------------------------------------
var io = socketIo.listen(server);

io.sockets.on('connection', function(socket){
  // message
  socket.on('join', function(data) {
    if (typeof data === 'string') {
      socket.join(data);
    } else {
      console.log("invalid join arguments:", data);
    }
  });
  socket.on('leave', function(data) {
    if (typeof data === 'string') {
      socket.leave(data);
    } else {
      console.log("invalid join arguments:", data);
    }
  });
  socket.on('list', function(data) {
    socket.emit('list', Object.keys(channels));
  });
});

//-----------------------------------------------------------------------------
// channel
//-----------------------------------------------------------------------------
var channels = {};
var channelTimeout = 60 * 1000;
function createChannel(channel) {
  channels[channel] = setTimeout(function() {
    delete channels[channel];
  }, channelTimeout);
}
function updateChannel(channel) {
  if (channels[channel] !== void 0) {
    clearTimeout(channels[channel]);
  }
  createChannel(channel);
}

/* vim: set expandtab ts=2 sw=2 tw=80: */
