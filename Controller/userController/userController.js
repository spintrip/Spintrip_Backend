const {signup , login, verify} = require('./userAuthentication');
const {getprofile, putprofile, uploadProfile, deleteuser, getaddress, postaddress, verifyAadhar, verifyDl, verifyPan} = require('./userProfile');
const { getbrand, features, findvehicles, onevehicle, getvehicleadditional, postwishlist, cancelwishlist, getwishlist, getallVehicles, toprating, findCabs } = require('./userVehicle');
const {booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating} = require('./userBooking');
const { chat, chathistory } = require('./userChat');
const {updateDeviceToken} =require ('./userDevice');
const { getWalletDetails, initiateRecharge, walletWebhook, walletWithdraw } = require('./userWallet');
 
module.exports = {
    signup , login, verify, getprofile, putprofile, uploadProfile, deleteuser, getbrand, features, findvehicles, onevehicle, getvehicleadditional, 
    postwishlist, cancelwishlist, getwishlist,getallVehicles, toprating, booking, extend, breakup, cancelbooking, userbookings, getfeedback, transactions, rating, chat, chathistory,
    updateDeviceToken, getaddress, postaddress, findCabs, getWalletDetails, initiateRecharge, walletWebhook, walletWithdraw, verifyAadhar, verifyDl, verifyPan  
};
