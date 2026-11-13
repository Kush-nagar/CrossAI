import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Cookie Policy · Cross',
  description: 'The cookies and browser storage Cross uses, and why there is no cookie banner.',
}

// Must match the cookies the server actually sets (scripts/lib/session.mjs,
// scripts/lib/crossAuth.mjs, scripts/lib/demoGate.mjs) and the localStorage
// keys in web/lib. If a non-essential cookie or tracker is ever added, this
// page AND a consent banner are both required before it ships.
export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        Cross uses only the cookies it needs to sign you in and keep your account secure. We don&apos;t use
        advertising, analytics or tracking cookies, and we don&apos;t let third parties set cookies through Cross. That
        is why Cross has no cookie banner: strictly necessary cookies don&apos;t require consent. If that ever changes,
        we&apos;ll ask for your consent first.
      </p>

      <h2>Cookies we set</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Purpose</th>
            <th scope="col">How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>__Host-cross_sid</code>
            </td>
            <td>Keeps you signed in. Contains a random, signed session ID; it can&apos;t be read by page scripts.</td>
            <td>Up to 30 days; ends after 12 hours of inactivity or when you sign out</td>
          </tr>
          <tr>
            <td>
              <code>__Host-cross_pkce</code>
            </td>
            <td>Protects the sign-in process by tying a sign-in link to the browser that requested it.</td>
            <td>10 minutes, removed once sign-in completes</td>
          </tr>
          <tr>
            <td>
              <code>__Host-cross_gstate</code>
            </td>
            <td>Protects Google sign-in from forged requests by tying Google&apos;s reply to the browser that started it.</td>
            <td>10 minutes, removed once sign-in completes</td>
          </tr>
        </tbody>
      </table>

      <h2>Storage in your browser</h2>
      <p>
        Cross also saves some things in your browser&apos;s local storage so they work without being stored on our
        servers: your chat history, saved and struck judges, judge notes, your case list, and preferences such as
        theme and reduced motion. This data stays on your device. Deleting your account clears it from the browser you
        delete from, and you can clear it any time by clearing this site&apos;s data in your browser settings.
      </p>

      <h2>Fonts</h2>
      <p>
        Pages load typefaces from Fontshare and Google Fonts. Those services receive your IP address when the fonts
        download, but Cross doesn&apos;t use them to set cookies or track you. See the{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
