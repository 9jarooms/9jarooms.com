import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      guestEmail,
      guestName,
      bookingId,
      propertyName,
      roomName,
      address,
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      checkInInstructions,
      houseRules,
      totalAmount,
      nights,
    } = body;

    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(totalAmount);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1a1a1a;padding:30px 40px;text-align:center;">
      <h1 style="color:#059669;margin:0;font-size:24px;font-weight:700;">9jaRooms</h1>
      <p style="color:#888;margin:8px 0 0;font-size:14px;">Your home away from home</p>
    </div>

    <!-- Content -->
    <div style="padding:40px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:48px;margin-bottom:10px;">✅</div>
        <h2 style="color:#1a1a1a;margin:0;font-size:22px;">Booking Confirmed!</h2>
        <p style="color:#666;margin:8px 0 0;">Hi ${guestName}, your reservation is all set.</p>
      </div>

      <!-- Booking Details -->
      <div style="background:#f9fafb;border-radius:10px;padding:24px;margin-bottom:24px;">
        <h3 style="color:#1a1a1a;margin:0 0 16px;font-size:16px;">🏠 Booking Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Property</td>
            <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${propertyName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Room</td>
            <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${roomName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Check-in</td>
            <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${checkIn} at ${checkInTime}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Check-out</td>
            <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${checkOut} at ${checkOutTime}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Nights</td>
            <td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${nights}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:12px 0 8px;color:#1a1a1a;font-size:16px;font-weight:700;">Total Paid</td>
            <td style="padding:12px 0 8px;color:#059669;font-size:16px;font-weight:700;text-align:right;">${formattedAmount}</td>
          </tr>
        </table>
      </div>

      <!-- Address -->
      <div style="background:#ecfdf5;border-radius:10px;padding:24px;margin-bottom:24px;border-left:4px solid #059669;">
        <h3 style="color:#1a1a1a;margin:0 0 8px;font-size:16px;">📍 Property Address</h3>
        <p style="color:#333;margin:0;font-size:14px;line-height:1.6;">${address}</p>
      </div>

      ${checkInInstructions ? `
      <!-- Check-in Instructions -->
      <div style="background:#fefce8;border-radius:10px;padding:24px;margin-bottom:24px;border-left:4px solid #facc15;">
        <h3 style="color:#1a1a1a;margin:0 0 8px;font-size:16px;">🔑 Check-in Instructions</h3>
        <p style="color:#333;margin:0;font-size:14px;line-height:1.6;">${checkInInstructions}</p>
      </div>
      ` : ''}

      ${houseRules ? `
      <!-- House Rules -->
      <div style="background:#f9fafb;border-radius:10px;padding:24px;margin-bottom:24px;">
        <h3 style="color:#1a1a1a;margin:0 0 8px;font-size:16px;">📋 House Rules</h3>
        <p style="color:#666;margin:0;font-size:14px;line-height:1.6;">${houseRules}</p>
      </div>
      ` : ''}

      <p style="color:#666;font-size:14px;line-height:1.6;text-align:center;">
        Booking Reference: <strong>${bookingId}</strong><br>
        If you have any questions, reply to this email or contact us on WhatsApp.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#999;font-size:12px;margin:0;">© 2025 9jaRooms. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await getResend().emails.send({
      from: '9jaRooms <bookings@9jarooms.com>',
      to: guestEmail,
      subject: `✅ Booking Confirmed — ${propertyName}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
