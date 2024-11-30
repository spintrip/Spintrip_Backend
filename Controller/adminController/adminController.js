const { adminLogin, verifyOTP, adminSignup, adminProfile } = require('./authentication');
const { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost } = require('./userHostManagement');
const { deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars, getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById } = require('./carListManagement');
const { createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById } = require('./payoutManagement');
const { getAllBookings, getBookingById, updateBookingById, deleteBookingById } = require('./bookingManagement');
const { createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById } = require('./brandPricingManagement');
const { createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById } = require('./taxFeatureManagement');
const { viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats } = require('./supportChatManagement');
const { sendNotification } = require('./notificationManagement');
const {allTransactions, getTransactionById, updateTransactionById, deleteTransactionById} = require('./adminTransactions');
const {getDevice, getDeviceById, postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById} = require('./adminDevice');
const {pendingProfile, approveProfile, rejectProfile} = require('./adminProfileManagement');
const {pendingCarProfile, approveCarProfile, rejectCarProfile} = require('./adminCarManagement');

module.exports = {
  adminLogin, verifyOTP, deleteBike, updateBike, bikeById, bikes, cars, carsById, updateCars, deleteCars,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById,
  getAllBookings, getBookingById, updateBookingById, deleteBookingById,
  createOrUpdateBrand, getAllBrands, updateBrandById, adminSignup,getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification, adminProfile, allTransactions, getTransactionById, updateTransactionById, deleteTransactionById,
  getDevice, getDeviceById, postCarDevice,getCarDevice, getCarDeviceById, updateCarDevice, deleteCarDeviceById,
  pendingProfile, approveProfile, rejectProfile, pendingCarProfile, approveCarProfile, rejectCarProfile
};