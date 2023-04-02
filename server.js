const grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
const { Pool } = require("pg");

const PROTO_PATH = "./CRUD.proto";
const pool = new Pool({
  user: "postgres",
  host: "localhost", // container ID PostgreSQL di Docker
  database: "grpcprotobuf_db",
  password: "toor123",
  port: 5432,
});

const server = new grpc.Server();

server.bindAsync(
  "localhost:50051",
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Server running on port ${port}`);
    server.start();
  }
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const userService = protoDescriptor.crud.UserService;

function createUser(call, callback) {
  const { name, email } = call.request;

  pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    [name, email],
    (error, results) => {
      if (error) {
        if (error.code === "23505") {
          // constraint violation error
          callback({
            code: grpc.status.ALREADY_EXISTS,
            message: `User with email ${email} already exists`,
          });
          return;
        }
        callback(error);
        return;
      }
      const user = results.rows[0];
      callback(null, { user });
    }
  );
}

function readUser(call, callback) {
  const { id } = call.request || {};

  pool.query("SELECT * FROM users WHERE id = $1", [id], (error, results) => {
    if (error) {
      callback(error);
      return;
    }
    const user = results.rows[0];
    if (!user) {
      callback({ code: grpc.status.NOT_FOUND, message: "User not found" });
      return;
    }
    callback(null, { user });
  });
}

function updateUser(call, callback) {
  const { id, name, email } = call.request || {};

  pool.query(
    "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
    [name, email, id],
    (error, results) => {
      if (error) {
        callback(error);
        return;
      }
      const user = results.rows[0];
      if (!user) {
        callback({ code: grpc.status.NOT_FOUND, message: "User not found" });
        return;
      }
      callback(null, { user });
    }
  );
}
function deleteUser(call, callback) {
  const id = call.request.id || 0;
  pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING *",
    [Number(id)],
    (error, results) => {
      if (error) {
        callback({
          code: grpc.status.INTERNAL,
          details: "Error deleting user from database: " + error.message,
        });
        return;
      }
      if (results.rows.length === 0) {
        callback({
          code: grpc.status.NOT_FOUND,
          details: "User with id=" + id + " not found in database",
        });
        return;
      }
      const deletedUser = results.rows[0];
      callback(null, { user: deletedUser });
    }
  );
}

server.addService(userService.service, {
  createUser,
  readUser,
  updateUser,
  deleteUser,
});
