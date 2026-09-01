const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { StatusCodes } = require("http-status-codes");
require("dotenv").config();
const connectDB = require("./src/config/db");
const { sendResponse } = require("./src/services/CommonService");

["JWT_SECRET", "INTERNAL_API_KEY"].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

connectDB();

const routes = require("./src/routes");
const { ResponseMessage } = require("./src/utils/ResponseMessage");
app.use("/api", routes);

app.use((req, res) => {
  sendResponse(res, StatusCodes.NOT_FOUND, ResponseMessage.ROUTE_NOT_FOUND);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? ResponseMessage.FILE_TOO_LARGE
        : err.message;
    return sendResponse(res, StatusCodes.BAD_REQUEST, message);
  }
  if (err) {
    if (err.statusCode) return sendResponse(res, err.statusCode, err.message);
    console.error(err);
    return sendResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      ResponseMessage.INTERNAL_SERVER_ERROR
    );
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
