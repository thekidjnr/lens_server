import express, { Express, ErrorRequestHandler } from "express";

import cors, { CorsOptions } from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
// import "./utils/watermark.worker";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
dotenv.config();

import authRoute from "./routes/auth.routes";
import userRoute from "./routes/user.routes";
import collectionRoute from "./routes/collection.routes";
import watermarkRoute from "./routes/watermark.routes";
import fileRoute from "./routes/file.routes";
import workspaceRoute from "./routes/workspace.routes";
import s3Route from "./routes/s3.routes";
import logger from "./utils/common/logger";

// import "./workers/batch.watermark.worker";

const app: Express = express();
const httpServer = createServer(app);

// MONGODB CONNECTION
const connect = async () => {
  const mongoUri = process.env.MONGO_URI!;
  try {
    await mongoose.connect(mongoUri);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection error: %O", err);
    throw err;
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB Disconnected");
});

//MIDDLEWARES
app.use(express.json());
app.use(cookieParser());

// REQUEST LOGGING MIDDLEWARE
app.use((req, res, next) => {
  const start = Date.now();

  // Log the incoming request
  logger.info(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Log the response when it finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode}`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// CORS POLICIES
const corsOptions: CorsOptions = {
  origin: [
    "https://www.lenslyst.com",
    "https://dashboard.lenslyst.com",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  exposedHeaders: ["Set-Cookie", "Date", "ETag"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

//ROUTES
app.get("/", (req, res) => {
  res.send("Welcome Lenslyst");
});

// Add this health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/workspace", workspaceRoute);
app.use("/collections", collectionRoute);
app.use("/collections", watermarkRoute);
app.use("/files", fileRoute);
app.use("/s3", s3Route);

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const errorStatus = err.status || 500;
  const errorMessage = err.message || "Something went wrong";

  logger.error("Error: %s\nStack: %s", errorMessage, err.stack);

  res.status(errorStatus).json({
    success: false,
    status: errorStatus,
    message: errorMessage,
    stack: err.stack,
  });
};

// Use the error handler
app.use(errorHandler);

// watermarkWorker.on("completed", (job) => {
//   logger.info(`Job ${job.id} has been completed`);
// });

//PORT FOR LISTENING TO APP
httpServer.listen(`${process.env.PORT}`, () => {
  connect();
  logger.info(`Server is running on port ${process.env.PORT}`);
});
