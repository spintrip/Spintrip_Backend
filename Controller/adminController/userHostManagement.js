const { User, Host, Admin, UserAdditional, HostAdditional, Driver, DriverAdditional } = require('../../Models');


const getAllUsers = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }


    const users = await User.findAll();
    const userAdditional = await UserAdditional.findAll();
    const drivers = await Driver.findAll({ include: [{ model: DriverAdditional }] });

    const usersWithAdditionalInfo = users.map(user => {
      let additionalInfo = userAdditional.find(additional => additional.id === user.id);
      
      if (user.role === 'driver' || user.role === 'Driver') {
        const driverProfile = drivers.find(d => d.userId === user.id);
        if (driverProfile && driverProfile.DriverAdditional) {
           additionalInfo = driverProfile.DriverAdditional;
        }
      }

      return {
        ...user.toJSON(),
        additionalInfo: additionalInfo ? (additionalInfo.toJSON ? additionalInfo.toJSON() : additionalInfo) : null
      };
    });

    res.status(200).json({ message: "All available Users", users: usersWithAdditionalInfo });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the additional info separately
    const additionalInfo = await UserAdditional.findOne({
      where: { id: user.id }
    });

    res.status(200).json({
      user: {
        ...user.toJSON(),
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching user', error });
  }
};

const deleteUser = async (req, res) => {
  const transaction = await User.sequelize.transaction();
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ message: 'User not found' });
    }

    // Comprehensive Cleanup using Transaction
    // 1. Delete Additional Info
    await UserAdditional.destroy({ where: { id: userId }, transaction });
    
    // 2. Delete Admin record if exists (Safety)
    await Admin.destroy({ where: { id: userId }, transaction });

    // 3. Delete Driver & DriverAdditional if exists
    // Also delete any Cab assigned to this driver and keep-alive records
    const { Cab, DriverKeepAlive, DriverWithdrawal } = require('../../Models');
    if (Cab) await Cab.destroy({ where: { driverId: userId }, transaction });
    if (DriverKeepAlive) await DriverKeepAlive.destroy({ where: { driverId: userId }, transaction });
    if (DriverWithdrawal) await DriverWithdrawal.destroy({ where: { driverId: userId }, transaction });
    
    await DriverAdditional.destroy({ where: { id: userId }, transaction });
    await Driver.destroy({ where: { id: userId }, transaction });

    // 4. Delete Host & HostAdditional
    await HostAdditional.destroy({ where: { id: userId }, transaction });
    await Host.destroy({ where: { id: userId }, transaction });

    // 5. Delete other related records that might block re-registration or cause foreign key errors
    const { Wallet, ReferralReward, UserAddress, CabBookingRequest, CabBookingAccepted, Booking, Support, SupportChat, Wishlist, Transaction } = require('../../Models');
    
    // Cleanup active requests and confirmations first
    if (CabBookingAccepted) await CabBookingAccepted.destroy({ where: { driverId: userId }, transaction });
    if (CabBookingRequest) {
        await CabBookingRequest.destroy({ where: { userId }, transaction });
        await CabBookingRequest.destroy({ where: { driverId: userId }, transaction });
    }

    // Cleanup other user-specific entities
    if (Booking) await Booking.destroy({ where: { id: userId }, transaction }); // Some models use 'id' as User extension
    if (Booking) await Booking.destroy({ where: { userId }, transaction });
    
    if (SupportChat) await SupportChat.destroy({ where: { userId }, transaction });
    if (Support) await Support.destroy({ where: { userId }, transaction });
    
    if (Wishlist) await Wishlist.destroy({ where: { userId }, transaction });
    if (Transaction) await Transaction.destroy({ where: { userId }, transaction });
    
    if (Wallet) await Wallet.destroy({ where: { userId }, transaction });
    if (ReferralReward) await ReferralReward.destroy({ where: { userId }, transaction });
    if (UserAddress) await UserAddress.destroy({ where: { userid: userId }, transaction });

    // 6. Finally delete the User
    await user.destroy({ transaction });

    await transaction.commit();
    res.status(200).json({ message: 'User and all associated data deleted successfully for a fresh start.' });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete User Error:", error);
    res.status(500).json({ message: 'Error deleting user completely', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    console.log(req.user.id);
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { additionalInfo, ...userData } = req.body;
    await user.update(userData);

    if (additionalInfo) {
      let additionalRecord = await UserAdditional.findOne({ where: { id: req.params.id } });

      if (additionalRecord) {
        await additionalRecord.update(additionalInfo);
      } 
    }

    // Fetch the updated user data and additional info separately
    const updatedUser = await User.findByPk(req.params.id);
    const updatedAdditionalInfo = await UserAdditional.findOne({ where: { id:  req.params.id  } });

    res.status(200).json({
      message: 'User updated successfully',
      user: {
        ...updatedUser.toJSON(),
        additionalInfo: updatedAdditionalInfo ? updatedAdditionalInfo.toJSON() : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating user', error });
  }
};

const getAllHosts = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const hosts = await Host.findAll({
      include: [
        { model: HostAdditional },
        { model: User, attributes: ['phone', 'role'] }
      ]
    });

    const formattedHosts = hosts.map(h => {
      const json = h.toJSON();
      json.FullName = json.HostAdditional?.FullName || json.HostAdditional?.businessName || '--';
      json.phone = json.User?.phone || '--';
      json.role = 'host';
      json.additionalInfo = json.HostAdditional || {}; // Map legacy frontend dependency
      return json;
    });

    res.status(200).json({ "message": "All available Hosts", hosts: formattedHosts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching host', error });
  }
};

const getHostById = async (req, res) => {
  // Functionality here
};

const deleteHost = async (req, res) => {
  // In Spintrip, a Host IS a User. Deleting the User account is the correct way
  // to ensure they can start over completely.
  return deleteUser(req, res);
};

module.exports = { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost };