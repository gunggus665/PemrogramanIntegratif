const grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
const readline = require("readline");
const { Pool } = require("pg");

const PROTO_PATH = "./CRUD.proto";
const clientUri = "localhost:50051";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "grpcprotobuf_db",
  password: "toor123",
  port: 5432,
});

let conn = null;
let client = null;

async function connectToServer() {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH);
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const userService = protoDescriptor.crud.UserService;
  client = new userService(clientUri, grpc.credentials.createInsecure());
  console.log("Connected to User Management Server!");
}

async function main() {
  conn = await pool.connect();
  await connectToServer();
  mainMenu();
}

async function createUser() {
  rl.question("Masukkan nama: ", async (name) => {
    rl.question("Masukkan email: ", (email) => {
      console.log("Creating user...");
      client.createUser({ name: name, email: email }, async (err, response) => {
        if (err) {
          console.error(err);
        } else {
          console.log("User created ");
          if (response.user && response.user.id) {
            // add a null check here
            const { rows } = await conn.query(
              "SELECT * FROM users WHERE id = $1",
              [response.user.id]
            );
            console.log("User details: ", rows[0]);
          }
        }
        rl.close();
      });
    });
  });
}

async function readUser() {
  rl.question("Masukkan ID user: ", async (id) => {
    console.log("Reading user...");
    const userId = parseInt(id); // konversi id ke tipe data integer
    const { rows } = await conn.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (rows.length > 0) {
      console.log("User details: ", rows[0]);
    } else {
      console.log("User not found");
    }
    rl.close();
  });
}
async function updateUser() {
  rl.question("Masukkan ID user yang ingin diupdate: ", async (id) => {
    if (!id || isNaN(id) || parseInt(id) <= 0) {
      console.error("Invalid ID. Please enter a valid integer ID.");
      rl.close();
      return;
    }
    rl.question("Masukkan nama baru: ", async (name) => {
      rl.question("Masukkan email baru: ", async (email) => {
        console.log("Updating user...");
        const parsedId = parseInt(id);
        const query = `UPDATE users SET name = '${name}', email = '${email}' WHERE id = ${parsedId}`;
        const { rowCount } = await conn.query(query);
        if (rowCount === 0) {
          console.error("User not found.");
        } else {
          console.log("User updated successfully.");
          const { rows } = await conn.query(
            "SELECT * FROM users WHERE id = $1",
            [parsedId]
          );
          console.log("User details: ", rows[0]);
        }
        rl.close();
      });
    });
  });
}

async function deleteUser() {
  rl.question("Masukkan ID user yang ingin dihapus: ", async (id) => {
    const userId = { id: id };
    client.deleteUser(userId, async (err, response) => {
      if (err) {
        console.error(err);
      } else {
        console.log("User deleted ");
      }
      rl.close();
    });
  });
}

async function mainMenu() {
  console.log("=== User Management System ===");
  console.log("1. Create user");
  console.log("2. Read user");
  console.log("3. Update user");
  console.log("4. Delete user");
  console.log("5. Exit");

  rl.question("Masukkan pilihan: ", async (option) => {
    switch (option) {
      case "1":
        await createUser();
        break;
      case "2":
        await readUser();
        break;
      case "3":
        await updateUser();
        break;
      case "4":
        await deleteUser();
        break;
      case "5":
        console.log("Exiting...");
        rl.close();
        break;
      default:
        console.log("Pilihan tidak valid");
        mainMenu();
        break;
    }
  });
}

main();
