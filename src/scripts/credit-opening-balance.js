require("dotenv").config();

const mongoose = require("mongoose");
const connectToDB = require("../config/db");
const accountModel = require("../models/account.model");
const ledgerModel = require("../models/ledger.model");
const transactionModel = require("../models/transaction.model");

const OPENING_BALANCE = 500;

async function creditOpeningBalance(account) {
  const idempotencyKey = `initial-balance-${account._id}`;

  let transaction = await transactionModel.findOne({ idempotencyKey });

  if (!transaction) {
    transaction = await transactionModel.create({
      fromAccount: account._id,
      toAccount: account._id,
      amount: OPENING_BALANCE,
      idempotencyKey,
      status: "COMPLETED",
    });
  }

  const existingLedgerEntry = await ledgerModel.findOne({
    account: account._id,
    transaction: transaction._id,
    type: "CREDIT",
  });

  if (existingLedgerEntry) {
    return false;
  }

  await ledgerModel.create({
    account: account._id,
    amount: OPENING_BALANCE,
    transaction: transaction._id,
    type: "CREDIT",
  });

  return true;
}

async function run() {
  await connectToDB();

  const accounts = await accountModel.find({});
  let creditedCount = 0;

  for (const account of accounts) {
    const credited = await creditOpeningBalance(account);

    if (credited) {
      creditedCount += 1;
    }
  }

  console.log(`Opening balance credited to ${creditedCount} account(s).`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Failed to credit opening balance", error);
  await mongoose.disconnect();
  process.exit(1);
});
