import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/privacy' },
  description: 'What Cross collects, why, who it is shared with, and how to delete it.',
}

// Keep this page in step with the code. Every claim here is about real
// behavior: if a data flow, processor, cookie or retention rule changes in
// scripts/ or web/, update the matching section in the same change.
export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Cross is an AI debate coach operated by Cross AI (&quot;Cross&quot;, &quot;we&quot;, &quot;us&quot;), based in
        California, USA. Cross AI is not yet incorporated as a company. This policy explains what we collect when you
        use cross-ai.dev, why, who we share it with, and the choices you have. If anything here is unclear, email{' '}
        {mail}.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect what Cross needs to work: your sign-in email, what you send to the coach, and your practice data.</li>
        <li>We don&apos;t sell your personal information, show ads, or use advertising or analytics trackers.</li>
        <li>
          What you send to the coach is processed by AI providers to generate replies. Don&apos;t include anything you
          wouldn&apos;t want processed that way.
        </li>
        <li>
          You can delete your account and server-side data at any time in <strong>Settings → Your data</strong>.
        </li>
        <li>Cross is for people 13 and older. If you are under 18, you need a parent or guardian&apos;s permission.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>Account information</h3>
      <p>
        When you sign in with Google or an emailed link, we receive your email address and, from Google, your display
        name. We keep a session record (a hashed session ID, when it was created and last used, and when it expires) so
        you stay signed in.
      </p>
      <h3>Tabroom link (optional)</h3>
      <p>
        If you link a Tabroom account in Settings, you type your Tabroom username and password. We use the password once
        to sign in to OpenCaselist and Tabroom on your behalf and <strong>never store it</strong>. We store your
        Tabroom username and the access tokens those services return, encrypted, so Cross can look up disclosed
        positions and judge information for you. You can unlink at any time.
      </p>
      <h3>What you send to the coach</h3>
      <p>
        Your chat messages, the cases, flows, images and documents you upload, and your speech recordings. Your chat
        history is saved <strong>only in your browser</strong>, not on our servers.
      </p>
      <h3>Practice data we store on our servers</h3>
      <ul>
        <li>
          <strong>Voice calibration:</strong> transcripts of your calibration readings and the word corrections learned
          from them.
        </li>
        <li>
          <strong>Delivery history:</strong> for graded speeches, your speaking pace, length, score and, if tone analysis
          is enabled, a summary of vocal tone.
        </li>
        <li>
          <strong>Uploaded files:</strong> audio recordings and PDF cases you upload, and documents Cross generates for
          you. These are visible only to your account. Our hosting resets file storage when the service is redeployed,
          so these files may be deleted without notice. Keep your own copies.
        </li>
        <li>
          <strong>Feedback:</strong> if you answer &quot;was this helpful?&quot;, your answer, your reason, and a short
          excerpt of the reply you rated. Your feedback is used to adjust future replies to you.
        </li>
      </ul>
      <h3>Technical information</h3>
      <p>
        Like any website, our servers receive your IP address and basic request details. We use IP addresses briefly, in
        memory, to rate-limit requests and prevent abuse. Our hosting provider keeps standard server logs.
      </p>
      <h3>Stored in your browser</h3>
      <p>
        Chat history, saved and struck judges, your case list, and display preferences (theme, reduced motion) are kept
        in your browser&apos;s local storage. They never leave your device unless you send them to the coach. See the{' '}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h3>The card library</h3>
      <p>
        Cross shows individual evidence cards from Public Forum cases that debate teams chose to disclose publicly on
        openCaselist, along with the name of the team that disclosed each card. If you&apos;re a debater and want a card
        or your team&apos;s name removed from Cross, email {mail} and we&apos;ll take it down.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide Cross: generate coaching replies, grade drills, transcribe speeches and look up judges.</li>
        <li>To keep you signed in and keep your data separate from other users&apos;.</li>
        <li>To personalize coaching to you (voice calibration, delivery trends, your feedback).</li>
        <li>To prevent abuse and control costs (rate limits and usage caps).</li>
        <li>To respond when you contact us.</li>
      </ul>
      <p>We do not use your data for advertising, and we do not sell or &quot;share&quot; it for cross-context behavioral advertising.</p>

      <h2>Who we share it with</h2>
      <p>We share data only with the service providers that run Cross, and only what each needs:</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">What it receives</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>NVIDIA (AI models)</td>
            <td>Your messages, uploaded text and images, transcripts, and the coaching context</td>
            <td>Generating replies and grading</td>
          </tr>
          <tr>
            <td>Groq and Hume AI (if enabled)</td>
            <td>Your audio recordings</td>
            <td>Speech-to-text; Hume also analyzes vocal tone</td>
          </tr>
          <tr>
            <td>Tavily (if enabled)</td>
            <td>Search queries the coach writes</td>
            <td>Looking up current facts such as this year&apos;s topic</td>
          </tr>
          <tr>
            <td>Supabase</td>
            <td>Your account, sessions and encrypted Tabroom link</td>
            <td>Sign-in and database</td>
          </tr>
          <tr>
            <td>Google</td>
            <td>Your sign-in, if you choose Google</td>
            <td>Authentication</td>
          </tr>
          <tr>
            <td>Render</td>
            <td>All of the above, as our host</td>
            <td>Running the website and storing files</td>
          </tr>
          <tr>
            <td>Cloudflare</td>
            <td>Your requests for our domain name</td>
            <td>DNS</td>
          </tr>
          <tr>
            <td>Tabroom.com, OpenCaselist, tournaments.tech</td>
            <td>Judge names you look up; your Tabroom access tokens if linked</td>
            <td>Judge paradigms and disclosed positions</td>
          </tr>
          <tr>
            <td>Fontshare (Indian Type Foundry) and Google Fonts</td>
            <td>Your IP address when the page loads its fonts</td>
            <td>Displaying the site&apos;s typefaces</td>
          </tr>
        </tbody>
      </table>
      <p>
        Each provider handles data under its own terms and privacy policy, and some may keep request data for a limited
        time, for example for abuse monitoring. We may also disclose information if the law requires it, to protect
        someone&apos;s safety, or as part of a transfer if Cross is ever acquired or reorganized, in which case this
        policy would continue to apply to your data.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and practice data: until you delete your account.</li>
        <li>Sessions: they expire after 12 hours of inactivity, and after 30 days at most.</li>
        <li>Uploaded and generated files: until you delete your account, or sooner if our hosting resets storage.</li>
        <li>Delivery history: the most recent 500 graded speeches.</li>
        <li>Feedback: the most recent 200 answers.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>Delete:</strong> go to <strong>Settings → Your data → Delete account and data</strong>. This
          permanently deletes your account, Tabroom link, voice calibration, delivery history, feedback and files, and
          clears the chat history saved in that browser. You can also email {mail}.
        </li>
        <li>
          <strong>Access or correct:</strong> email {mail} and we&apos;ll send you a copy of the data we hold about you
          or fix what&apos;s wrong.
        </li>
        <li>
          <strong>Unlink Tabroom:</strong> in Settings at any time.
        </li>
        <li>
          <strong>Clear browser data:</strong> clearing this site&apos;s data in your browser removes your local chat
          history and preferences.
        </li>
      </ul>
      <p>
        <strong>California residents</strong> have the right to know what personal information we collect, use and
        disclose; to delete it; to correct it; and to opt out of its sale or sharing. We don&apos;t sell or share
        personal information, so there is nothing to opt out of. We won&apos;t treat you differently for using these
        rights. To make a request, email {mail}. We may need to confirm the request comes from your account&apos;s email
        address. An authorized agent can make a request on your behalf with your written permission.
      </p>
      <p>We respond to requests within 30 days.</p>

      <h2>Children and teens</h2>
      <p>
        Cross is not for children under 13, and we don&apos;t knowingly collect personal information from them. If you
        are 13 to 17, you need a parent or guardian&apos;s permission to use Cross. If you believe a child under 13 has
        an account, email {mail} and we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        Data in transit is encrypted with HTTPS. Tabroom tokens are encrypted at rest. Session cookies are HttpOnly and
        cannot be read by page scripts. No system is perfectly secure; if we learn of a breach affecting your
        information, we will notify you as the law requires.
      </p>

      <h2>Where your data is processed</h2>
      <p>Cross is run from the United States, and your information is processed and stored in the United States.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll update the date at the top. If a change materially affects how we use
        data we already hold, we&apos;ll tell you in the app or by email before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>Cross AI, California, USA · {mail}</p>
    </LegalPage>
  )
}
