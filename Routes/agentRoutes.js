const express = require("express");
const { authenticate } = require("../Middleware/authMiddleware");
const { 
  createAgentBooking, 
  getAgentPerformance, 
  getAgentBookings,
  postAgentDriver,
  getAgentDrivers,
  deleteAgentDriver,
  verifyAgentDriverProfile,
  getAgentWallet,
  depositAgentWallet,
  adjustAgentCreditLimit,
  activateAgentSubscription
} = require("../Controller/agentController");

const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../s3Config');
const path = require('path');

const agentDriverImageStorage = multerS3({
  s3: s3,
  bucket: 'spintrip-s3bucket',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const targetId = req.body.id || req.user.id;
    const fileName = `driver_${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`;
    const filePath = `${targetId}/${fileName}`;
    cb(null, filePath);
  }
});
const agentUpload = multer({ storage: agentDriverImageStorage });
const verifyAgentUpload = agentUpload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'profilePic', maxCount: 1 },
  { name: 'dlFile', maxCount: 1 },
  { name: 'panFile', maxCount: 1 }
]);

const router = express.Router();

// Middleware to strictly enforce agent authorization
const restrictToAgent = (req, res, next) => {
  if (!req.user || req.user.role !== "agent") {
    return res.status(403).json({ message: "Forbidden: You must be authenticated as an Agent to access this resource." });
  }
  next();
};

// Agent portal routes
router.post("/booking", authenticate, restrictToAgent, createAgentBooking);
router.get("/performance", authenticate, restrictToAgent, getAgentPerformance);
router.get("/bookings", authenticate, restrictToAgent, getAgentBookings);

// Agent wallet & ledger routes
router.get("/wallet", authenticate, restrictToAgent, getAgentWallet);
router.post("/wallet/deposit", authenticate, restrictToAgent, depositAgentWallet);
router.post("/wallet/credit-limit", authenticate, adjustAgentCreditLimit); // Allow admin or systems to adjust credit limits
router.post("/activate-subscription", authenticate, restrictToAgent, activateAgentSubscription);

// Agent driver management routes
router.post("/driver", authenticate, restrictToAgent, postAgentDriver);
router.get("/drivers", authenticate, restrictToAgent, getAgentDrivers);
router.delete("/driver/:id", authenticate, restrictToAgent, deleteAgentDriver);
router.put("/driververify", authenticate, restrictToAgent, verifyAgentUpload, verifyAgentDriverProfile);

module.exports = router;
