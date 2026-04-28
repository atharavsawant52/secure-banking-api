const mongoose = require("mongoose");

const connectToDB = async () => {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("mongodb is connected successfully");
    })
    .catch((err) => {
      console.log("Mongodb is not connected", err);
      process.exit(1);
    });
};

module.exports = connectToDB;
