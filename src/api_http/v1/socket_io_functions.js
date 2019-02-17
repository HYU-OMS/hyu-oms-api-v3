const onConnection = (socket) => {
  socket.on('select_group', (data) => {
    const existing_rooms = Object.keys(socket.rooms);
    for(let i = 0; i < existing_rooms.length; i++) {
      const name = existing_rooms[i];
      if(name.slice(0, 6) === "group_") {
        socket.leave(name, (err) => {
          if(process.env.NODE_ENV === 'development') {
            const err_stack = err.stack;
            console.log(err_stack);
          }
        });
      }
    }

    const group_id = data['group_id'];
    const group_name = "group_" + group_id.toString();

    socket.join(group_name);
  });

  socket.on('disconnect', () => {
    const existing_rooms = Object.keys(socket.rooms);
    for(let i = 0; i < existing_rooms.length; i++) {
      const name = existing_rooms[i];
      if(name.slice(0, 6) === "group_") {
        socket.leave(name, (err) => {
          if(process.env.NODE_ENV === 'development') {
            const err_stack = err.stack;
            console.log(err_stack);
          }
        });
      }
    }
  });
};

export default onConnection;