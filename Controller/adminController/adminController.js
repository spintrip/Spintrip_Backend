const { adminLogin, verifyOTP } = require('./authentication');
const { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost } = require('./userHostManagement');
const { getAllCars, getCarById, updateCarById, deleteCarById, getAllListings, getListingById, updateListingById, deleteListingById } = require('./carListManagement');
const { createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById } = require('./payoutManagement');
const { getAllBookings, getBookingById, updateBookingById, deleteBookingById } = require('./bookingManagement');
const { createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById } = require('./brandPricingManagement');
const { createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById } = require('./taxFeatureManagement');
const { viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats } = require('./supportChatManagement');
const { sendNotification } = require('./notificationManagement');

module.exports = {
  adminLogin, verifyOTP,
  getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost,
  getAllCars, getCarById, updateCarById, deleteCarById, getAllListings, getListingById, updateListingById, deleteListingById,
  createPayout, getAllPayouts, getPayoutById, updatePayoutById, deletePayoutById,
  getAllBookings, getBookingById, updateBookingById, deleteBookingById,
  createOrUpdateBrand, getAllBrands, updateBrandById, getPricing, updatePricingById,
  createTax, getAllTaxes, updateTaxById, deleteTaxById, createFeature, getAllFeatures, deleteFeatureById,
  viewAllSupportTickets, replyToSupportTicket, escalateSupportTicket, resolveSupportTicket, viewAllChats,
  sendNotification
};