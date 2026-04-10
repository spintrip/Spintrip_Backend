const { adminLogin, verifyOTP, adminSignup, adminProfile } = require('./authentication');
const { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost, convertHostToDriver } = require('./userHostManagement');
const { deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars, getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById, postActiveVehicle  } = require('./carListManagement');
const { createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById } = require('./payoutManagement');
const { getAllBookings, getBookingById, updateBookingById, deleteBookingById, cancelCabBooking, sendCabInvoice, createAdminBooking } = require('./bookingManagement');
const { createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById } = require('./brandPricingManagement');
const { createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById } = require('./taxFeatureManagement');
const { viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats } = require('./supportChatManagement');
const { sendNotification } = require('./notificationManagement');
const {allTransactions, getTransactionById, updateTransactionById, deleteTransactionById} = require('./adminTransactions');
const {getDevice, getDeviceById, postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById} = require('./adminDevice');
const {pendingProfile, approveProfile, rejectProfile} = require('./adminProfileManagement');
const {pendingVehicleProfile, approveVehicleProfile, rejectVehicleProfile} = require('./adminCarManagement');
const { subscriptions } = require('./adminSubsctiptions');
const { getAllFeedbacks, deleteFeedback } = require('./adminFeedbackManagement');
const { createVehicleType, getAllVehicleTypes, deleteVehicleType } = require('./adminVehicleTypeManagement');
const { createRecord, getAllRecords, getRecordById, updateRecord, deleteRecord } = require('./genericCrudController');
const { getAllCabs, getCabById, approveCabProfile, rejectCabProfile, getAllDrivers, getDriverById, approveDriverProfile, rejectDriverProfile, deleteDriver } = require('./adminCabDriverManagement');
const { getAllWithdrawals, approveWithdrawal, rejectWithdrawal } = require('./adminWithdrawalManagement');

module.exports = {
  adminLogin, verifyOTP, deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById,
  getAllBookings, getBookingById, updateBookingById, deleteBookingById, cancelCabBooking, sendCabInvoice,
  createOrUpdateBrand, getAllBrands, updateBrandById, adminSignup,getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification, adminProfile, allTransactions, getTransactionById, updateTransactionById, deleteTransactionById,
  getDevice, getDeviceById, postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById,
  pendingProfile, approveProfile, rejectProfile, pendingVehicleProfile, approveVehicleProfile, rejectVehicleProfile,postActiveVehicle,
  subscriptions,
  getAllFeedbacks, deleteFeedback,
  createVehicleType, getAllVehicleTypes, deleteVehicleType,
  createRecord, getAllRecords, getRecordById, updateRecord, deleteRecord,
  getAllCabs, getCabById, approveCabProfile, rejectCabProfile,
  getAllDrivers, getDriverById, approveDriverProfile, rejectDriverProfile, deleteDriver,
  getAllWithdrawals, approveWithdrawal, rejectWithdrawal, createAdminBooking, convertHostToDriver
};