const accountModel = require("../models/account.model");
const ledgerModel = require("../models/ledger.model");
const transactionModel = require("../models/transaction.model");

const INITIAL_ACCOUNT_BALANCE = 500;

async function addInitialAccountBalance(account) {
  const transaction = await transactionModel.create({
    fromAccount: account._id,
    toAccount: account._id,
    amount: INITIAL_ACCOUNT_BALANCE,
    idempotencyKey: `initial-balance-${account._id}`,
    status: "COMPLETED",
  });

  await ledgerModel.create({
    account: account._id,
    amount: INITIAL_ACCOUNT_BALANCE,
    transaction: transaction._id,
    type: "CREDIT",
  });

  return transaction;
}

async function createAccountController(req, res) {
  const user = req.user;

  const account = await accountModel.create({
    user: user._id,
  });

  await addInitialAccountBalance(account);

  res.status(201).json({
    account,
    openingBalance: INITIAL_ACCOUNT_BALANCE,
  });
}

async function getUserAccountsController(req, res) {
  const accounts = await accountModel.find({ user: req.user._id });

  res.status(200).json({
    accounts,
  });
}

async function getAccountBalanceController(req, res) {
  const { accountId } = req.params;

  const account = await accountModel.findOne({
    _id: accountId,
    user: req.user._id,
  });

  if (!account) {
    return res.status(404).json({
      message: "Account not found",
    });
  }

  const balance = await account.getBalance();

  res.status(200).json({
    accountId: account._id,
    balance: balance,
  });
}

module.exports = {
  createAccountController,
  getUserAccountsController,
  getAccountBalanceController,
};
