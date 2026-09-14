import http = require("node:http");
import process = require("node:process");
import mongoose = require("mongoose");
import createApp = require("./app");
import connectDatabase = require("./config/database");

async function startServer(): Promise<http.Server> {
  try {
    // connectDatabase also loads .env before PORT and CORS_ORIGIN are read.
    await connectDatabase();

    const port = Number(process.env.PORT ?? "3000");
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      throw new Error("PORT must be an integer between 0 and 65535.");
    }

    // Wait for unique indexes before accepting writes.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

    const server = http.createServer(createApp());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    let stopping = false;
    const stopServer = () => {
      if (stopping) return;
      stopping = true;

      const timeout = setTimeout(() => server.closeAllConnections(), 10000);
      timeout.unref();

      server.close((error) => {
        clearTimeout(timeout);
        if (error) process.exitCode = 1;
        mongoose.disconnect().catch(() => { process.exitCode = 1; });
      });
    };

    process.once("SIGINT", stopServer);
    process.once("SIGTERM", stopServer);
    server.once("close", () => {
      process.off("SIGINT", stopServer);
      process.off("SIGTERM", stopServer);
    });

    const address = server.address();
    if (address && typeof address !== "string") {
      console.log(`NEXTHIRE API is running at http://127.0.0.1:${address.port}`);
    }

    return server;
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
}

if (require.main === module) {
  startServer().catch(() => {
    console.error(
      "Server startup failed. Check MongoDB, MONGODB_URI, PORT, and whether the port is available."
    );
    process.exitCode = 1;
  });
}

export = startServer;
