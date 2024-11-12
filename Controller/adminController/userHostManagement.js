const { User, Host, Admin } = require('../../Models');


const getAllUsers = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }


    const users = await User.findAll();
    const userAdditional = await UserAdditional.findAll();

    const usersWithAdditionalInfo = users.map(user => {
      const additionalInfo = userAdditional.find(additional => additional.id === user.id);
      return {
        ...user.toJSON(),  // Convert Sequelize model instance to plain object
        additionalInfo: additionalInfo ? additionalInfo.toJSON() : null
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
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
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
    const hosts = await Host.findAll();
    res.status(200).json({ "message": "All available Hosts", hosts });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching host', error });
  }
};

const getHostById = async (req, res) => {
  // Functionality here
};

const deleteHost = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Host not found' });
    }
    const host = await Host.findByPk(req.params.id);
    if(!host){
      return res.status(404).json({ message: 'Host not found' });
    }
    await user.destroy();
    res.status(200).json({ message: 'Host deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
};

module.exports = { getAllUsers, getUserById, deleteUser, updateUser, getAllHosts, getHostById, deleteHost };