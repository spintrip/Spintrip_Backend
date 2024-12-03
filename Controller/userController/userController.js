const {signup , login, verify} = require('./userAuthentication');
const {getprofile, putprofile, uploadProfile, deleteuser} = require('./userProfile');
const { getbrand, features, findvehicles, onevehicle, getvehicleadditional, postwishlist, cancelwishlist, getwishlist, getallVehicles, toprating } = require('./userVehicle');
const {booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating} = require('./userBooking');
const { chat, chathistory } = require('./userChat');
const {updateDeviceToken} =require ('./userDevice');
 
module.exports = {
    signup , login, verify, getprofile, putprofile, uploadProfile, deleteuser, getbrand, features, findvehicles, onevehicle, getvehicleadditional, 
    postwishlist, cancelwishlist, getwishlist,getallVehicles, toprating, booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating, chat, chathistory,
    updateDeviceToken
};