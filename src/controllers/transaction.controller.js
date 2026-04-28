const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.services");
const mongoose = require("mongoose");

function parseAmount(amount) {
  if (typeof amount !== "number" && typeof amount !== "string") {
    return null;
  }

  const amountText = String(amount).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return null;
  }

  const parsedAmount = Number(amountText);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return null;
  }

  return parsedAmount;
}

function isMongoTransactionUnsupportedError(error) {
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    error?.message?.includes("Transaction numbers are only allowed") ||
    error?.message?.includes("replica set member or mongos")
  );
}

function getTransferPayload(fromAccount, toAccount, amount, idempotencyKey) {
  return {
    fromAccount,
    toAccount,
    amount,
    idempotencyKey,
    status: "PENDING",
  };
}

async function createLedgerEntry(account, amount, transactionId, type, session) {
  const ledgerEntry = new ledgerModel({
    account,
    amount,
    transaction: transactionId,
    type,
  });

  return ledgerEntry.save(session ? { session } : undefined);
}

async function completeTransaction(transaction, session) {
  transaction.status = "COMPLETED";
  await transaction.save(session ? { session } : undefined);
}

async function createTransferWithSession(
  fromAccount,
  toAccount,
  amount,
  idempotencyKey,
) {
  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.withTransaction(async () => {
      transaction = (
        await transactionModel.create(
          [getTransferPayload(fromAccount, toAccount, amount, idempotencyKey)],
          { session },
        )
      )[0];

      await createLedgerEntry(
        fromAccount,
        amount,
        transaction._id,
        "DEBIT",
        session,
      );
      await createLedgerEntry(
        toAccount,
        amount,
        transaction._id,
        "CREDIT",
        session,
      );
      await completeTransaction(transaction, session);
    });
  } finally {
    session.endSession();
  }

  return transaction;
}

async function createTransferWithoutSession(
  fromAccount,
  toAccount,
  amount,
  idempotencyKey,
) {
  const transaction = await transactionModel.create(
    getTransferPayload(fromAccount, toAccount, amount, idempotencyKey),
  );

  await createLedgerEntry(fromAccount, amount, transaction._id, "DEBIT");
  await createLedgerEntry(toAccount, amount, transaction._id, "CREDIT");
  await completeTransaction(transaction);

  return transaction;
}

async function recoverPendingTransfer(transaction, fromAccount, toAccount, amount) {
  const existingDebit = await ledgerModel.findOne({
    account: fromAccount,
    transaction: transaction._id,
    type: "DEBIT",
  });

  const existingCredit = await ledgerModel.findOne({
    account: toAccount,
    transaction: transaction._id,
    type: "CREDIT",
  });

  if (!existingDebit) {
    await createLedgerEntry(fromAccount, amount, transaction._id, "DEBIT");
  }

  if (!existingCredit) {
    await createLedgerEntry(toAccount, amount, transaction._id, "CREDIT");
  }

  await completeTransaction(transaction);

  return transaction;
}

/**
 * - Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

async function createTransaction(req, res) {
  /**
   * 1. Validate request
   */
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "FromAccount, toAccount, amount and idempotencyKey are required",
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(fromAccount) ||
    !mongoose.Types.ObjectId.isValid(toAccount)
  ) {
    return res.status(400).json({
      message: "Invalid fromAccount or toAccount",
    });
  }

  const parsedAmount = parseAmount(amount);

  if (!parsedAmount) {
    return res.status(400).json({
      message: "Amount must be a positive number with up to 2 decimal places",
    });
  }

  if (fromAccount === toAccount) {
    return res.status(400).json({
      message: "fromAccount and toAccount cannot be the same",
    });
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    return res.status(400).json({
      message: "idempotencyKey must be a string between 8 and 128 characters",
    });
  }

  const normalizedIdempotencyKey = idempotencyKey.trim();

  const fromUserAccount = await accountModel.findOne({
    _id: fromAccount,
    user: req.user._id,
  });

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!fromUserAccount || !toUserAccount) {
    return res.status(400).json({
      message: "Invalid fromAccount or toAccount",
    });
  }

  /**
   * 2. Validate idempotency key
   */

  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey: normalizedIdempotencyKey,
  });

  if (isTransactionAlreadyExists) {
    const isSameRequest =
      isTransactionAlreadyExists.fromAccount.toString() === fromAccount &&
      isTransactionAlreadyExists.toAccount.toString() === toAccount &&
      isTransactionAlreadyExists.amount === parsedAmount;

    if (!isSameRequest) {
      return res.status(409).json({
        message: "idempotencyKey has already been used for another request",
      });
    }

    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed",
        transaction: isTransactionAlreadyExists,
      });
    }

    if (isTransactionAlreadyExists.status === "PENDING") {
      try {
        const recoveredTransaction = await recoverPendingTransfer(
          isTransactionAlreadyExists,
          fromAccount,
          toAccount,
          parsedAmount,
        );

        return res.status(200).json({
          message: "Transaction completed successfully",
          transaction: recoveredTransaction,
        });
      } catch (error) {
        return res.status(202).json({
          message: "Transaction is still processing",
        });
      }
    }

    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please retry",
      });
    }

    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction was reversed, please retry",
      });
    }
  }

  /**
   * 3. Check account status
   */

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message:
        "Both fromAccount and toAccount must be ACTIVE to process transaction",
    });
  }

  /**
   * 4. Derive sender balance from ledger
   */
  const balance = await fromUserAccount.getBalance();

  if (balance < parsedAmount) {
    return res.status(400).json({
      message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${parsedAmount}`,
    });
  }

  let transaction;
  try {
    transaction = await createTransferWithSession(
      fromAccount,
      toAccount,
      parsedAmount,
      normalizedIdempotencyKey,
    );
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "idempotencyKey has already been used",
      });
    }

    if (isMongoTransactionUnsupportedError(error)) {
      try {
        transaction = await createTransferWithoutSession(
          fromAccount,
          toAccount,
          parsedAmount,
          normalizedIdempotencyKey,
        );
      } catch (fallbackError) {
        if (fallbackError.code === 11000) {
          return res.status(409).json({
            message: "idempotencyKey has already been used",
          });
        }

        return res.status(500).json({
          message: "Unable to process transaction",
        });
      }
    } else {
      return res.status(500).json({
        message: "Unable to process transaction",
      });
    }
  }

  /**
   * 10. Send email notification
   */
  emailService.sendTransactionEmail(
    req.user.email,
    req.user.name,
    parsedAmount,
    toAccount,
  ).catch(() => {});

  return res.status(201).json({
    message: "Transaction completed successfully",
    transaction: transaction,
  });
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({
      message: "toAccount, amount and idempotencyKey are required",
    });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid toAccount",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
  });

  if (!fromUserAccount) {
    return res.status(400).json({
      message: "System user account not found",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const transaction = new transactionModel({
    fromAccount: fromUserAccount._id,
    toAccount,
    amount,
    idempotencyKey,
    status: "PENDING",
  });

  const debitLedgerEntry = await ledgerModel.create(
    [
      {
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT",
      },
    ],
    { session },
  );

  const creditLedgerEntry = await ledgerModel.create(
    [
      {
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT",
      },
    ],
    { session },
  );

  transaction.status = "COMPLETED";
  await transaction.save({ session });

  await session.commitTransaction();
  session.endSession();

  return res.status(201).json({
    message: "Initial funds transaction completed successfully",
    transaction: transaction,
  });
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
};
