import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

export type EmailEvent = {
  id: string;
  title: string;
  clubName: string;
  when: string;
  where: string | null;
  posterUrl: string | null;
  url: string;
  badge?: string;
};

export type EmailSection = { title: string; intro?: string; events: EmailEvent[] };

/** Email-safe colours (email clients don't support oklch or CSS variables). */
const C = { ink: "#14213d", muted: "#5b6478", paper: "#faf8f3", card: "#ffffff", border: "#e7e2d6", gold: "#f2b705", navy: "#0b2545" };

export function DigestEmail({
  preview,
  heading,
  greeting,
  sections,
  appUrl,
  manageUrl,
  unsubscribeUrl,
  unsubscribeLabel,
}: {
  preview: string;
  heading: string;
  greeting?: string;
  sections: EmailSection[];
  appUrl: string;
  manageUrl: string;
  unsubscribeUrl: string;
  unsubscribeLabel: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: C.paper, color: C.ink, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <Text style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, margin: "0 0 16px", color: C.ink }}>
            clubo<span style={{ color: C.gold }}>.</span>
          </Text>
          <Heading as="h1" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: 30, lineHeight: "36px", margin: "0 0 8px" }}>
            {heading}
          </Heading>
          {greeting && <Text style={{ color: C.muted, fontSize: 15, margin: "0 0 20px" }}>{greeting}</Text>}
          {sections.map((s) => (
            <Section key={s.title} style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.muted, margin: "0 0 8px" }}>{s.title}</Text>
              {s.intro && <Text style={{ fontSize: 14, color: C.muted, margin: "0 0 8px" }}>{s.intro}</Text>}
              {s.events.map((e) => (
                <Section key={e.id} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <Row>
                    {e.posterUrl && (
                      <Column style={{ width: 72, verticalAlign: "top" }}>
                        <Img src={e.posterUrl} alt="" width={64} height={80} style={{ borderRadius: 8, objectFit: "cover" }} />
                      </Column>
                    )}
                    <Column style={{ verticalAlign: "top", paddingLeft: e.posterUrl ? 8 : 0 }}>
                      {e.badge && (
                        <Text style={{ display: "inline-block", backgroundColor: "#fdecc8", color: "#6b4500", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", margin: "0 0 4px" }}>
                          {e.badge}
                        </Text>
                      )}
                      <Text style={{ fontSize: 12, color: C.muted, margin: 0 }}>{e.clubName}</Text>
                      <Link href={e.url} style={{ fontSize: 16, fontWeight: 600, color: C.ink, textDecoration: "none" }}>
                        {e.title}
                      </Link>
                      <Text style={{ fontSize: 13, color: C.muted, margin: "2px 0 0" }}>
                        {e.when}
                        {e.where ? ` · ${e.where}` : ""}
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          ))}
          <Button href={appUrl} style={{ backgroundColor: C.navy, color: "#fff", borderRadius: 999, padding: "12px 20px", fontSize: 14, fontWeight: 600 }}>
            See everything on Clubo
          </Button>
          <Hr style={{ borderColor: C.border, margin: "28px 0 12px" }} />
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: "18px" }}>
            You&rsquo;re getting this because of your Clubo email settings.{" "}
            <Link href={manageUrl} style={{ color: C.muted }}>Manage emails</Link> ·{" "}
            <Link href={unsubscribeUrl} style={{ color: C.muted }}>{unsubscribeLabel}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
