// Nodemailer transport using a Gmail App Password for info.trellishub@gmail.com.
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD are not set');
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  return t.sendMail({
    from: `Trellis <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || undefined
  });
}

function sendTeamNotification(subject, text) {
  return sendMail({ to: process.env.GMAIL_USER, subject, text });
}

module.exports = { sendMail, sendTeamNotification };
