import express, {
  Express,
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import cors, { CorsOptions } from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
dotenv.config();

import authRoute from "./routes/auth.routes";
import userRoute from "./routes/user.routes";
import projectRoute from "./routes/project.routes";
import fileRoute from "./routes/file.routes";

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
app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/project", projectRoute);
app.use("/files", fileRoute);

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

// Start Server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  connect();
  console.log(`Server is running on ${process.env.PORT}`);
});
