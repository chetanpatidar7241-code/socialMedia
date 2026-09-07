const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { StatusCodes } = require("http-status-codes");
const config = require("./src/config/env");
const connectDB = require("./src/config/db");
const { startInternalSubscriptions } = require("./src/messaging/internalSubscriber");
const { sendResponse } = require("./src/services/CommonService");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

connectDB();

// The public auth/post routes below don't depend on NATS at all, so a broker that
// isn't reachable yet must never block server startup — retry in the background
// instead of awaiting this or exiting the process on failure.
function startInternalSubscriptionsWithRetry(retryDelayMs = 5000) {
  startInternalSubscriptions().catch((err) => {
    console.error(
      `[nats] failed to start internal subscriptions, retrying in ${retryDelayMs}ms:`,
      err.message
    );
    setTimeout(() => startInternalSubscriptionsWithRetry(retryDelayMs), retryDelayMs);
  });
}
startInternalSubscriptionsWithRetry();

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

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
