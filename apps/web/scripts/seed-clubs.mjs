// Usage: node --env-file=../../.env scripts/seed-clubs.mjs
// Adds starter clubs (skips ones that already exist). Names fill in from Instagram on first scrape.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

const CLUBS = [
  { igHandle: "berkeleycodebase", name: "Codebase", category: ["Tech", "Professional/Career"] },
  { igHandle: "mlberkeley", name: "Machine Learning at Berkeley", category: ["Tech", "Academic"] },
  { igHandle: "callaunchpad", name: "Launchpad", category: ["Tech", "Academic"] },
  { igHandle: "dssberkeley", name: "Data Science Society", category: ["Tech", "Academic"] },
  { igHandle: "saasberkeley", name: "SaaS at Berkeley", category: ["Tech", "Professional/Career"] },
  { igHandle: "diversatech.berkeley", name: "DiversaTech", category: ["Tech", "Professional/Career"] },
  // Batch 2 (handles verified with apify/instagram-profile-scraper, Nov 2026)
  { igHandle: "calhacks", name: "Cal Hacks", category: ["Tech"] },
  { igHandle: "calblueprint", name: "Blueprint", category: ["Tech", "Service/Volunteering"] },
  { igHandle: "berkeleyanova", name: "ANova", category: ["Tech", "Service/Volunteering"] },
  { igHandle: "berkeleycodeology", name: "Codeology", category: ["Tech", "Professional/Career"] },
  { igHandle: "calblockchain", name: "Blockchain at Berkeley", category: ["Tech", "Professional/Career"] },
  { igHandle: "cubstartdecal", name: "Cubstart", category: ["Tech", "Academic"] },
  { igHandle: "csmentors", name: "Computer Science Mentors", category: ["Tech", "Academic"] },
  { igHandle: "uxatberkeley", name: "UX@Berkeley", category: ["Tech", "Arts & Performance"] },
  { igHandle: "xratberkeley", name: "Extended Reality @ Berkeley", category: ["Tech"] },
  { igHandle: "seb.berkeley", name: "Space Enterprise at Berkeley", category: ["Tech", "Academic"] },
  { igHandle: "berkeley_skydeck", name: "Berkeley SkyDeck", category: ["Tech", "Professional/Career"] },
  { igHandle: "berkeleyconsulting", name: "Berkeley Consulting", category: ["Professional/Career"] },
  { igHandle: "berkeleypbl", name: "Berkeley PBL", category: ["Professional/Career"] },
  { igHandle: "tamidberkeley", name: "TAMID @ UC Berkeley", category: ["Professional/Career"] },
  { igHandle: "tradersatberkeley", name: "Traders at Berkeley", category: ["Professional/Career", "Academic"] },
  { igHandle: "berkeleyinvestmentgroup", name: "Berkeley Investment Group", category: ["Professional/Career"] },
  { igHandle: "berkeleywib", name: "Berkeley Women in Business", category: ["Professional/Career", "Social"] },
  { igHandle: "berkeleyvss", name: "Venture Strategy Solutions", category: ["Professional/Career", "Tech"] },
  { igHandle: "180dcberkeley", name: "180 Degrees Consulting Berkeley", category: ["Professional/Career", "Service/Volunteering"] },
  { igHandle: "datagoodberkeley", name: "DataGood at Berkeley", category: ["Tech", "Service/Volunteering"] },
  { igHandle: "bigdata.berkeley", name: "Big Data at Berkeley", category: ["Tech", "Academic"] },
];

for (const c of CLUBS) {
  const ref = db.collection("clubs").doc(c.igHandle.replace(/\./g, "-"));
  if ((await ref.get()).exists) {
    console.log(`skip  @${c.igHandle} (exists)`);
    continue;
  }
  await ref.set({
    ...c,
    description: null,
    avatarUrl: null,
    website: null,
    active: true,
    optOut: false,
    scrapeIntervalHours: 24,
    scrapeStatus: null,
    lastScrapedAt: null,
    lastPostAt: null,
    stats: { postsScraped: 0, eventsFound: 0 },
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`added @${c.igHandle}`);
}
console.log("total clubs:", (await db.collection("clubs").count().get()).data().count);
