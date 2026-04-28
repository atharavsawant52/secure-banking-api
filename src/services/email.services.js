const nodemailer = require("nodemailer");

// ✅ Transporter setup
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

// ✅ Verify connection
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email server error:", error);
  } else {
    console.log("✅ Email service ready");
  }
});

// ✅ Currency Formatter (IMPORTANT FIX)
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

// ✅ Base Email Sender
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Secure Bank API" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("📩 Email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};



// =======================
// 📩 EMAIL TEMPLATES
// =======================

// ✅ Registration Email
const sendRegistrationEmail = async (userEmail, name) => {
  const subject = "Welcome to Secure Bank API";

  const text = `Hello ${name},

Welcome to Secure Bank API.

Your account has been successfully created.

Regards,
Secure Bank API Team`;

  const html = `
    <div style="font-family: Arial; padding: 20px;">
      <h2>Welcome, ${name} 👋</h2>
      <p>Your account is successfully created.</p>
      <p>We ensure secure banking experience.</p>
      <hr/>
      <p><b>Secure Bank API Team</b></p>
    </div>
  `;

  await sendEmail({ to: userEmail, subject, text, html });
};


// ✅ Transaction Success
const sendTransactionEmail = async (userEmail, name, amount, toAccount) => {
  const subject = "Transaction Successful";

  const formattedAmount = formatINR(amount);

  const text = `Hello ${name},

Your transaction was successful.

Amount: ${formattedAmount}
Transferred To: ${toAccount}

Regards,
Secure Bank API Team`;

  const html = `
    <div style="font-family: Arial; padding: 20px;">
      <h3 style="color: green;">Transaction Successful ✅</h3>
      <p>Hello ${name},</p>
      <ul>
        <li><b>Amount:</b> ${formattedAmount}</li>
        <li><b>To:</b> ${toAccount}</li>
      </ul>
      <p>Thanks for using our service.</p>
      <hr/>
      <p><b>Secure Bank API Team</b></p>
    </div>
  `;

  await sendEmail({ to: userEmail, subject, text, html });
};


// ❌ Transaction Failed
const sendTransactionFailureEmail = async (userEmail, name, amount, toAccount) => {
  const subject = "Transaction Failed";

  const formattedAmount = formatINR(amount);

  const text = `Hello ${name},

Your transaction failed.

Amount: ${formattedAmount}
Attempted To: ${toAccount}

Please try again.

Regards,
Secure Bank API Team`;

  const html = `
    <div style="font-family: Arial; padding: 20px;">
      <h3 style="color: red;">Transaction Failed ❌</h3>
      <p>Hello ${name},</p>
      <ul>
        <li><b>Amount:</b> ${formattedAmount}</li>
        <li><b>To:</b> ${toAccount}</li>
      </ul>
      <p>Please check balance or retry.</p>
      <hr/>
      <p><b>Secure Bank API Team</b></p>
    </div>
  `;

  await sendEmail({ to: userEmail, subject, text, html });
};


// =======================
// EXPORTS
// =======================

module.exports = {
  sendRegistrationEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail,
};