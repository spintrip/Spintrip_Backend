const { hostSignup , hostLogin, hostVerifyOtp, deleteHost, addVendor, getChildHosts } = require('./hostAuthentication');
const {hostProfile, updateProfile, verifyProfile, verifyProfileHandler, verifyDriverProfileHandler, verifyVendorProfile, deleteVendor, deleteDriver, verifyDriverProfile,postDriver,getAllDrivers} = require('./hostProfile');
const {getListing, createListing, putListing, deleteListing } = require('./hostListing');
const {getActiveSubscriptionForVehicle, getAllSubscriptions, postVehicle, pauseCab, resumeCab,  putVehicleAdditional, uploadvehicleImages, postPricing, assignDriver, getVehicleAdditional, activateVehicle, postMonthlyData, postGetFeedback, postGetVehicleReg} = require('./hostVehicles');
const {hostBookings, tripstart, bookingcompleted, DriverBookings, cancelbooking, postHostRating} = require('./hostBooking');
const {postFeatures, allFeatures, updateFeatures, deleteFeatures} = require('./hostFeatures');
const {getBrand} = require('./hostBrand');
const {deviceVehicleId} = require('./hostDevice');

module.exports = {
 getActiveSubscriptionForVehicle, getAllSubscriptions, hostSignup , hostLogin, hostVerifyOtp, deleteHost, hostProfile, updateProfile, verifyProfile, verifyProfileHandler, getListing, createListing, 
 putListing, deleteListing,postVehicle, putVehicleAdditional, uploadvehicleImages, postPricing, getVehicleAdditional, deleteVendor, activateVehicle, hostBookings, tripstart,
 bookingcompleted,cancelbooking, postHostRating, postFeatures, allFeatures, updateFeatures, deleteFeatures,verifyVendorProfile, getBrand, deviceVehicleId, postMonthlyData,
 postGetFeedback, postGetVehicleReg, postDriver,getAllDrivers, verifyDriverProfile, verifyDriverProfileHandler, assignDriver, DriverBookings, deleteDriver, pauseCab, resumeCab, addVendor, getChildHosts
};