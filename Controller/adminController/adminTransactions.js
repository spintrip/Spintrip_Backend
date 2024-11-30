const {Transaction, Admin} = require('../../Models');


const allTransactions = async(req, res) => {
    try {
      const adminId = req.user.id;
      const admin = await Admin.findByPk(adminId);
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      const transactions = await Transaction.findAll();
      res.status(200).json({ "message": "All available transaction", transactions });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching transaction', error });
    }
  };
  
  const getTransactionById = async (req, res) => {
    try {
      const transactions = await Transaction.findByPk(req.params.id);
      if (!transactions) {
        return res.status(404).json({ message: 'transaction not found' });
      }
      res.status(200).json({ transactions });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching booking', error });
    }
  };
  
  const updateTransactionById = async (req, res) => {
    try {
      const { id } = req.params;
      const updatedFields = req.body;
  
      const transactions = await Transaction.findByPk(id);
  
      if (!transactions) {
        return res.status(404).json({ message: 'transaction not found' });
      }
  
      await transactions.update(updatedFields);
  
      res.status(200).json({ message: 'transaction updated successfully', transactions });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating transaction', error });
    }
  };
  
  
  const deleteTransactionById =  async (req, res) => {
    try {
      await Transaction.destroy({ where: { Transactionid: req.params.id } });
      res.status(200).json({ message: 'Transaction deleted' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error deleting transaction', error });
    }
  };

  module.exports = {allTransactions, getTransactionById, updateTransactionById, deleteTransactionById};