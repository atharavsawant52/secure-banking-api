const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("✅ Secure Bank API email service is ready");
  }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Secure Bank API" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("📩 Message sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};

// Registration Email
async function sendRegistrationEmail(userEmail, name) {
  const subject = "Welcome to Secure Bank API";

  const text = `Hello ${name},

Welcome to Secure Bank API.

Your account has been successfully created and is now ready to use.
We are committed to providing you with a secure and seamless banking experience.

If you did not initiate this registration, please contact support immediately.

Regards,
Secure Bank API Team`;

  const html = `
        <h2>Welcome, ${name} 👋</h2>
        <p>Your account has been successfully created with <b>Secure Bank API</b>.</p>
        <p>We are committed to keeping your transactions secure and reliable.</p>
        <p><b>Note:</b> If this was not you, please contact support immediately.</p>
        <br/>
        <p>Regards,<br/><b>Secure Bank API Team</b></p>
    `;

  await sendEmail(userEmail, subject, text, html);
}

// Transaction Success Email
async function sendTransactionEmail(userEmail, name, amount, toAccount) {
  const subject = "Transaction Successful";

  const text = `Hello ${name},

Your transaction was successfully processed.

Amount: $${amount}
Transferred To: ${toAccount}

Thank you for using Secure Bank API.

Regards,
Secure Bank API Team`;

  const html = `
        <h3>Transaction Successful ✅</h3>
        <p>Hello ${name},</p>
        <p>Your transaction has been successfully completed.</p>
        <ul>
            <li><b>Amount:</b> $${amount}</li>
            <li><b>Transferred To:</b> ${toAccount}</li>
        </ul>
        <p>Thank you for trusting <b>Secure Bank API</b>.</p>
        <br/>
        <p>Regards,<br/><b>Secure Bank API Team</b></p>
    `;

  await sendEmail(userEmail, subject, text, html);
}

// Transaction Failure Email
async function sendTransactionFailureEmail(userEmail, name, amount, toAccount) {
  const subject = "Transaction Failed";

  const text = `Hello ${name},

We were unable to process your transaction.

Amount: $${amount}
Attempted To: ${toAccount}

Please verify your account balance or try again later.

Regards,
Secure Bank API Team`;

  const html = `
        <h3>Transaction Failed ❌</h3>
        <p>Hello ${name},</p>
        <p>We regret to inform you that your transaction could not be completed.</p>
        <ul>
            <li><b>Amount:</b> $${amount}</li>
            <li><b>Attempted To:</b> ${toAccount}</li>
        </ul>
        <p>Please check your balance or try again later.</p>
        <br/>
        <p>Regards,<br/><b>Secure Bank API Team</b></p>
    `;

  await sendEmail(userEmail, subject, text, html);
}

module.exports = {
  sendRegistrationEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail,
};
