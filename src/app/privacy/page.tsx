export const metadata = {
  title: "Privacy Policy | 9jaRooms",
  description: "How 9jaRooms collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-gray-800">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-gray-500">Last updated: 26 August 2026</p>

      <div className="space-y-6 leading-relaxed">
        <p>
          9jaRooms (&quot;we&quot;, &quot;us&quot;) operates shortlet apartments in Abuja, Nigeria.
          This policy explains what personal information we collect and how we use it when you
          use our website, make a booking, or chat with us on WhatsApp or other channels.
        </p>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Information we collect</h2>
          <p>
            When you book or enquire, we collect your name, phone number, email address,
            booking dates, and payment confirmation details. If you contact us on WhatsApp,
            we receive your WhatsApp profile name, phone number, and the messages you send us.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">How we use it</h2>
          <p>
            We use your information to process bookings, take payments (via our payment
            processor, Paystack), send booking confirmations and check-in details, respond to
            your enquiries, and improve our service. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Messaging</h2>
          <p>
            Conversations with us on WhatsApp are processed through the WhatsApp Business
            Platform provided by Meta. Message content is stored securely so we can manage
            your booking and support requests. Automated replies may be used to help you book
            faster; you can ask to speak to a team member at any time.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Storage &amp; security</h2>
          <p>
            Your data is stored on secure cloud infrastructure with access limited to the
            9jaRooms team. Payment card details are handled entirely by Paystack and never
            stored by us.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal
            information at any time by contacting us. We retain booking records only as long
            as needed for legal and accounting purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold">Contact</h2>
          <p>
            For any privacy questions, contact us via the details on{" "}
            <a href="https://www.9jarooms.com" className="underline">9jarooms.com</a> or
            message us on WhatsApp.
          </p>
        </section>
      </div>
    </main>
  );
}
