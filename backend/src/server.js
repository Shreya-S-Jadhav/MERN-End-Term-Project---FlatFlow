import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;

app.use(express.json());

app.get("/api/health", (request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  response.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

async function startServer() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Add it to backend/.env.");
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`FlatFlow API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start FlatFlow API:", error.message);
  process.exitCode = 1;
});
