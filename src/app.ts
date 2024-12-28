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
import s3Route from "./routes/s3.routes";

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
  origin: ["https://lenslyst.com", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  exposedHeaders: ["Set-Cookie", "Date", "ETag"],
};

app.use(cors(corsOptions));

//ROUTES
app.get("/", (req, res) => {
  res.send("Welcome Lenslyst");
});

app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/workspace", workspaceRoute);
app.use("/collections", collectionRoute);
app.use("/files", fileRoute);
app.use("/s3", s3Route);

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

//PORT FOR LISTENING TO APP
httpServer.listen(`${process.env.PORT}`, () => {
  connect();
  console.log(`Server is running on ${process.env.PORT}`);
});
