export const metadata = { title: 'Privacy Policy — Ashtronomical' }

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: May 31, 2026</p>

      <p>
        Ashtronomical (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal budgeting tool. This policy explains what
        data we collect, how we use it, and the choices you have. We built this product to help you manage your money —
        not to monetize your data.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your name, email address, and a securely hashed password.</li>
        <li><strong>Financial data:</strong> transactions, balances, budgets, savings goals, and debts you enter or import.</li>
        <li><strong>Bank connections:</strong> if you link an account through Plaid, we store an access token that lets us
          retrieve your transactions. This token is <strong>encrypted at rest</strong>.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide budgeting features: categorizing transactions, tracking spending, and showing insights.</li>
        <li>To send you account emails (verification, password resets) and, if enabled, budget alerts and summaries.</li>
        <li>We do <strong>not</strong> sell your personal or financial data to third parties.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        We use Plaid to connect to financial institutions. Plaid&rsquo;s handling of your data is governed by their own
        privacy policy. We use an email provider to deliver account notifications.
      </p>

      <h2>Data security</h2>
      <p>
        Passwords are hashed with bcrypt. Bank access tokens are encrypted with AES-256-GCM. We rate-limit login attempts
        to protect against unauthorized access. No system is perfectly secure, but we take reasonable measures to protect
        your information.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can export all of your data at any time from Settings.</li>
        <li>You can disconnect a bank account, which removes the stored access token.</li>
        <li>You can delete your account, which permanently removes all associated data.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions about this policy? Reach out through the email associated with your account.</p>
    </>
  )
}
