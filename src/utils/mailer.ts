import { Resend } from 'resend';

export async function sendLicenseEmail(email: string, serial: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'onboarding@resend.dev',   // Resend sandbox sender — works without domain verification
    to: email,
    subject: 'Your WorkMate License Key',
    html: `
      <h2>Thanks for purchasing WorkMate!</h2>
      <p>Your license key is:</p>
      <h1 style="letter-spacing: 2px; font-family: monospace;">${serial}</h1>
      <p>Enter this in the WorkMate app to activate your license.</p>
    `,
  });
}
