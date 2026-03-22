const { Cab, Driver, Vehicle, VehicleAdditional, DriverAdditional, User, UserAdditional } = require('../../Models');

const getAllCabs = async (req, res) => {
    try {
        const cabs = await Cab.findAll({
            include: [
                { model: Vehicle, include: [{ model: VehicleAdditional }] },
                { model: Driver, include: [{ model: DriverAdditional }] }
            ]
        });
        res.status(200).json({ cabs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching cabs', error: error.message });
    }
};

const getCabById = async (req, res) => {
    try {
        const cab = await Cab.findByPk(req.params.id, {
            include: [
                { model: Vehicle, include: [{ model: VehicleAdditional }] },
                { model: Driver, include: [{ model: DriverAdditional }] }
            ]
        });
        if (!cab) return res.status(404).json({ message: 'Cab not found' });
        res.status(200).json(cab);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching cab', error: error.message });
    }
};

const approveCabProfile = async (req, res) => {
    try {
        await VehicleAdditional.update({ verification_status: 2 }, { where: { vehicleid: req.params.id } });
        res.status(200).json({ message: 'Cab profile approved' });
    } catch (error) {
        res.status(500).json({ message: 'Error approving cab', error: error.message });
    }
};

const rejectCabProfile = async (req, res) => {
    try {
        await VehicleAdditional.update({ verification_status: null }, { where: { vehicleid: req.params.id } });
        res.status(200).json({ message: 'Cab profile rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting cab', error: error.message });
    }
};

const getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.findAll({
            include: [
                { model: DriverAdditional }, 
                { model: User, include: [{ model: UserAdditional }] }
            ]
        });
        // Frontend often expects basic properties flattened
        const formattedDrivers = drivers.map(d => {
            const json = d.toJSON();
            // DriverAdditional contains FullName and phone might be in User, but frontend drivers.js uses `row.name`?
            json.name = json.DriverAdditional?.FullName;
            json.phone = json.User?.phone;
            json.verification_status = json.DriverAdditional?.verification_status || 0;
            json.profilepic = json.DriverAdditional?.profilepic || null;
            json.aadhar = json.DriverAdditional?.aadhar || null;
            json.dl = json.DriverAdditional?.dl || null;
            return json;
        });
        res.status(200).json({ drivers: formattedDrivers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching drivers', error: error.message });
    }
};

const getDriverById = async (req, res) => {
    try {
        const driver = await Driver.findByPk(req.params.id, {
            include: [
                { model: DriverAdditional }, 
                { model: User, include: [{ model: UserAdditional }] }
            ]
        });
        if (!driver) return res.status(404).json({ message: 'Driver not found' });
        res.status(200).json(driver);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching driver', error: error.message });
    }
};

const approveDriverProfile = async (req, res) => {
    try {
        await DriverAdditional.update({ verification_status: 2 }, { where: { id: req.params.id } });
        res.status(200).json({ message: 'Driver profile approved' });
    } catch (error) {
        res.status(500).json({ message: 'Error approving driver', error: error.message });
    }
};

const rejectDriverProfile = async (req, res) => {
    try {
        await DriverAdditional.update({ verification_status: null }, { where: { id: req.params.id } });
        res.status(200).json({ message: 'Driver profile rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting driver', error: error.message });
    }
};

module.exports = {
    getAllCabs, getCabById, approveCabProfile, rejectCabProfile,
    getAllDrivers, getDriverById, approveDriverProfile, rejectDriverProfile
};
