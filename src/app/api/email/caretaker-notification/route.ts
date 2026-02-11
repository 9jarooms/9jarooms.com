import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      caretakerEmail,
      caretakerName,
      guestName,
      guestPhone,
      propertyName,
      roomName,
      checkIn,
      checkOut,
    } = body;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1a;padding:30px 40px;text-align:center;">
      <h1 style="color:#059669;margin:0;font-size:24px;font-weight:700;">9jaRooms</h1>
      <p style="color:#888;margin:8px 0 0;font-size:14px;">Caretaker Notification</p>
    </div>
    <div style="padding:40px;">
      <h2 style="color:#1a1a1a;margin:0 0 20px;font-size:20px;">📢 New Booking Alert</h2>
      <p style="color:#666;font-size:14px;line-height:1.6;">Hi ${caretakerName}, a new booking has been confirmed for your property.</p>
      <div style="background:#f9fafb;border-radius:10px;padding:24px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Property</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${propertyName}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Room</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${roomName}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Guest</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${guestName}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Phone</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${guestPhone || 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Check-in</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${checkIn}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px;">Check-out</td><td style="padding:8px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${checkOut}</td></tr>
        </table>
      </div>
      <p style="color:#666;font-size:14px;">Please ensure the property is ready for the guest.</p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#999;font-size:12px;margin:0;">© 2025 9jaRooms</p>
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await getResend().emails.send({
      from: '9jaRooms <notifications@9jarooms.com>',
      to: caretakerEmail,
      subject: `📢 New Booking — ${propertyName} (${checkIn} → ${checkOut})`,
      html: emailHtml,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error) {
    console.error('Caretaker notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
