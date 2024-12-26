import express, { Express, ErrorRequestHandler } from "express";

import { APIGatewayEvent, Context, Callback } from "aws-lambda";
import serverlessExpress from "aws-serverless-express";
import cors, { CorsOptions } from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
dotenv.config();

import authRoute from "./routes/auth.routes";
import userRoute from "./routes/user.routes";
import collectionRoute from "./routes/collection.routes";
import fileRoute from "./routes/file.routes";
import workspaceRoute from "./routes/workspace.routes";
import uploadRoute from "./routes/upload.routes";

const app: Express = express();
const httpServer = createServer(app);

//MONGODB CONNECTION
mongoose.set("strictQuery", false);
const connect = async () => {
  const mongoUri = process.env.MONGO_URI!;
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (err) {
    throw err;
  }
};

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB Disconnected");
});

//MIDDLEWARES
app.use(express.json());
app.use(cookieParser());

// CORS POLICIES
const corsOptions: CorsOptions = {
  origin: ["https://www.buknr.com", "http://localhost:3000"],
  credentials: true,
  exposedHeaders: ["Set-Cookie", "Date", "ETag"],
};

app.use(cors(corsOptions));

//ROUTES
app.get("/", (req, res) => {
  res.send("Welcome to my API");
});

app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/workspace", workspaceRoute);
app.use("/collections", collectionRoute);
app.use("/files", fileRoute);
app.use("/upload", uploadRoute);

//ERROR HANDLERS
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const errorStatus = err.status || 500;
  const errorMessage = err.message || "Something went wrong";

  res.status(errorStatus).json({
    success: false,
    status: errorStatus,
    message: errorMessage,
    stack: err.stack,
  });
};

// Use the error handler
app.use(errorHandler);

// Start server locally if not in production
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
    connect();
  });
}

// Start Server
const server = serverlessExpress.createServer(app);

// Lambda handler
export const lambdaHandler = (
  event: APIGatewayEvent,
  context: Context,
  callback: Callback
) => {
  return serverlessExpress.proxy(server, event, context);
};

export default app;
