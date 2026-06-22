const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientEmail, clientName, bookingDate, bookingTime } = req.body;

  if (!clientEmail || !clientName || !bookingDate || !bookingTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const confirmationMsg = {
    to: clientEmail,
    from: 'bookings@trellishub.co.za',
    subject: 'Your Consultation is Confirmed',
    text: `Hello ${clientName}, your consultation is booked for ${bookingDate} at ${bookingTime}.`,
    html: `<p>Hello ${clientName},</p>
           <p>Your consultation is booked for <strong>${bookingDate}</strong> at <strong>${bookingTime}</strong>.</p>
           <p>We look forward to seeing you!</p>`
  };

  const notificationMsg = {
    to: 'support@trellishub.co.za',
    from: 'bookings@trellishub.co.za',
    subject: 'New Consultation Booking',
    text: `New booking: ${clientName} on ${bookingDate} at ${bookingTime}. Contact: ${clientEmail}`,
    html: `<p><strong>New booking received:</strong></p>
           <p>Client: ${clientName}</p>
           <p>Date: ${bookingDate}</p>
           <p>Time: ${bookingTime}</p>
           <p>Email: ${clientEmail}</p>`
  };

  try {
    await sgMail.send(confirmationMsg);
    await sgMail.send(notificationMsg);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
