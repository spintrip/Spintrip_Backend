const { Host, Car, User, Listing, HostAdditional, UserAdditional, Booking, Pricing, Brand, Feedback, carFeature, Feature, Blog, carDevices, Device, Transaction, Vehicle, Bike, VehicleAdditional, HostPayment } = require('../../Models');
const uuid = require('uuid');


  //Listing
 const getListing = async(req, res) => {
    const hostid = req.user.userid;
    const host = await Host.findOne({ where: { id: hostid } });
    if (host) {
      try {
        const listing = await Listing.findAll({ where: { hostid: hostid } });
        const listings = listing.map(async (lstg) => {
          let vehicle = await Vehicle.findOne({ where: { vehicleid: lstg.vehicleid, hostId: hostid } });
          if (!vehicle) {
            return;
          }
           let vehicleAdditional = await VehicleAdditional.findOne({ where: { vehicleid: lstg.vehicleid } });
          let lk = {
            id: lstg.id,
            vehicleid: lstg.vehicleid,
            hostId: lstg.hostid,
            details: lstg.details,
            startDate: lstg.start_date,
            startTime: lstg.start_time,
            endDate: lstg.end_date,
            endTime: lstg.end_time,
            pauseTimeStartDate: lstg.pausetime_start_date,
            pauseTimeEndDate: lstg.pausetime_end_date,
            pauseTimeStartTime: lstg.pausetime_start_time,
            pauseTimeEndTime: lstg.pausetime_end_time,
            bookingId: lstg.bookingId,
            rcNumber: vehicle.Rcnumber,
            vehicletype: vehicle.vehicletype,
            vehicleImage1: vehicleAdditional.vehicleimage1,
            vehicleImage2: vehicleAdditional.vehicleimage2,
            vehicleImage3: vehicleAdditional.vehicleimage3,
            vehicleImage4: vehicleAdditional.vehicleimage4,
            vehicleImage5: vehicleAdditional.vehicleimage5,
          }
          return { ...lk };
        });
        const hostListings = await Promise.all(listings);
        res.status(201).json({ message: "Listing successfully queried", hostListings })
      }
      catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error showing listings' });
      }
    }
    else {
      res.status(401).json({ message: 'Unauthorized User' });
    }
  
  };

  const createListing = async(req, res) => {
    const { vehicleid } = req.body;
    try {
      const host = await Host.findByPk(req.user.id);
      const vehiclehostid = req.user.id;
  
      if (!host) {
        return res.status(401).json({ message: 'No Host found' });
      }
      const listingid = uuid.v4();
      const listings = await Listing.create({
        id: listingid,
        vehicleid: vehicleid,
        hostid: vehiclehostid,
      });
  
      const listing = {
        id: listings.id,
        vehicleid: listings.vehicleid,
        hostId: listings.hostid,
        details: listings.details,
        startDate: listings.start_date,
        startTime: listings.start_time,
        endDate: listings.end_date,
        endTime: listings.end_time,
        pauseTimeStartDate: listings.pausetime_start_date,
        pauseTimeEndDate: listings.pausetime_end_date,
        pauseTimeStartTime: listings.pausetime_start_time,
        pauseTimeEndTime: listings.pausetime_end_time,
        bookingId: listings.bookingId
      }
      res.status(200).json({ message: 'Listing created successfully', listing });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error Adding Listing' });
    }
  };

  //Put Listing
  const putListing = async(req, res) => {
    try {
      // Get the listing ID from the request body
      const { listingId, details, startDate, startTime, endDate, endTime, pauseTimeStartDate, pauseTimeEndDate, pauseTimeEndTime, pauseTimeStartTime, hourCount } = req.body;
      const hostid = req.user.userid;
      const host = await Host.findOne({ where: { id: hostid } });
      // Check if the authenticated user is a host
      if (!host) {
        return res.status(401).json({ message: 'Unauthorized User' });
      }
  
      const listing = await Listing.findOne({
        where: { id: listingId, hostid: hostid },
      });
  
      // If the listing doesn't exist or doesn't belong to the host, return an error
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }
  
      // Update the listing's details
      await listing.update({
        details: details,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        pausetime_start_date: pauseTimeStartDate,
        pausetime_end_date: pauseTimeEndDate,
        pausetime_start_time: pauseTimeStartTime,
        pausetime_end_time: pauseTimeEndTime,
        hourcount: hourCount
      });
  
      const listings = {
        id: listing.id,
        vehicleid: listing.vehicleid,
        hostId: listing.hostid,
        details: listing.details,
        startDate: listing.start_date,
        startTime: listing.start_time,
        endDate: listing.end_date,
        endTime: listing.end_time,
        pauseTimeStartDate: listing.pausetime_start_date,
        pauseTimeEndDate: listing.pausetime_end_date,
        pauseTimeStartTime: listing.pausetime_start_time,
        pauseTimeEndTime: listing.pausetime_end_time,
        bookingId: listing.bookingId
      }
  
      res.status(200).json({ message: 'Listing updated successfully', updatedListing: listings });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating listing' });
    }
  };


  
  //Delete Listing
  const deleteListing = async(req, res) => {
    try {
      // Get the listing ID from the request parameters
      const listingId = req.body.listingId;
      const hostid = req.user.userid;
  
      // Check if the authenticated user is a host
      const host = await Host.findOne({ where: { id: hostid } });
      if (!host) {
        return res.status(401).json({ message: 'Unauthorised User' });
      }
  
      // Find the listing
      const listing = await Listing.findOne({
        where: { id: listingId, hostid },
      });
  
      // If the listing doesn't exist or doesn't belong to the host, return an error
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }
  
      await listing.destroy();
      res.status(201).json({ message: 'Listing reset successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error deleting listing' });
    }
  };

  module.exports = {getListing, createListing, putListing, deleteListing};