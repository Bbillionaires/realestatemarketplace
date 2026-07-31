import { InfoPage } from '../../components/InfoPage';
import { theme } from '../../lib/theme';

export default function ContactPage() {
  return (
    <InfoPage title="Contact Us">
      <p>Have a question about your account, a listing, or a conversation that needs attention from our team?</p>
      <p>
        Email us at{' '}
        <a href="mailto:support@affordablehomematch.com" style={{ color: theme.primary, fontWeight: 600 }}>
          support@affordablehomematch.com
        </a>{' '}
        and we'll get back to you as soon as we can.
      </p>
      <p>
        If you have a safety concern about a specific conversation, email us with the conversation details and our
        moderation team will review it.
      </p>
    </InfoPage>
  );
}
