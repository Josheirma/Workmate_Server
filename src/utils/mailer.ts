import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}


// So the architecture should be:

// paypal.ts
//    ↓
// create/store serial with email_sent = false
//    ↓
// return success

// emailRetry.ts
//    ↓
// find email_sent = false
//    ↓
// sendLicenseEmail(...)
//    ↓
// Resend
//    ↓
// email_sent = true


// paypal.ts → creates the purchase/serial and leaves email_sent = false
// emailRetry.ts → sends the email
// emailRetry.ts → sets email_sent = true only after successful sending
// mailer.ts → contains the actual Resend code

export async function sendLicenseEmail(email: string, serial: string) {
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Your WorkMate Activation",
    // html: `
    //   <h2>Thanks for purchasing WorkMate!</h2>
    //   <p>Your activation was successful. Your registration ID is:</p>
    //   <h1 style="letter-spacing:2px;font-family:monospace;">${escapeHtml(serial)}</h1>
    //   <p>Keep this email for your records.</p>
    // `,
    text: `Thanks for purchasing WorkMate!\n\nYour activation code is: 1111\n\nKeep this email for your records.`,
  })
}