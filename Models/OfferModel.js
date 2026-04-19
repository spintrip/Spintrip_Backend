module.exports = (sequelize, DataTypes) => {
  const Offer = sequelize.define("Offer", {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    code: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true 
    },
    percentage: { 
      type: DataTypes.FLOAT, 
      allowNull: false,
      defaultValue: 0 
    },
    maxDiscount: { 
      type: DataTypes.FLOAT, 
      allowNull: false,
      defaultValue: 0 
    },
    minAmount: { 
      type: DataTypes.FLOAT, 
      allowNull: false,
      defaultValue: 0 
    },
    expiryDate: { 
      type: DataTypes.DATE, 
      allowNull: true 
    },
    isActive: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true 
    },
    usageLimit: { 
      type: DataTypes.INTEGER, 
      defaultValue: -1 // -1 for unlimited
    },
    usedCount: { 
      type: DataTypes.INTEGER, 
      defaultValue: 0 
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    }
  });

  return Offer;
};
