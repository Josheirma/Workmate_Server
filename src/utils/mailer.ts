import { Resend } from "resend"

// Single instance — not re-created on every email
const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function sendLicenseEmail(email: string, serial: string) {
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Your WorkMate License Key",
    html: `
      <h2>Thanks for purchasing WorkMate!</h2>
      <p>Your license key is:</p>
      <h1 style="letter-spacing:2px;font-family:monospace;">${escapeHtml(serial)}</h1>
      <p>Enter this in the WorkMate app to activate your license.</p>
    `,
  })
}
