import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/*<h1 style="letter-spacing:2px;font-family:monospace;">${escapeHtml(serial)}</h1>*/
export async function sendLicenseEmail(email: string, serial: string) {
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Your WorkMate Activation",
    html: `
      <h2>Thanks for purchasing WorkMate!</h2>
      <p>Your activation was successful. Your registration ID is:</p>
      <h1 style="letter-spacing:2px;font-family:monospace;">1024</h1>
      
      <p>Keep this email for your records.</p>
    `,
  })
}
