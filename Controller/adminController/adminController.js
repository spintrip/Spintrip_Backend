const { adminLogin, verifyOTP, adminSignup, adminProfile } = require('./authentication');
const { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost } = require('./userHostManagement');
const { getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById } = require('./carListManagement');
const { createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById } = require('./payoutManagement');
const { getAllBookings, getBookingById, updateBookingById, deleteBookingById } = require('./bookingManagement');
const { createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById } = require('./brandPricingManagement');
const { createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById } = require('./taxFeatureManagement');
const { viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats } = require('./supportChatManagement');
const { sendNotification } = require('./notificationManagement');

module.exports = {
  adminLogin, verifyOTP,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllvehicles, getvehicleById, updatevehicleById, deletevehicleById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById,
  getAllBookings, getBookingById, updateBookingById, deleteBookingById,
  createOrUpdateBrand, getAllBrands, updateBrandById, adminSignup,getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification, adminProfile
};