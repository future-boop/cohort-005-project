// PROTOTYPE — throwaway. Fills the Knock Development feed with Notifications from
// the v1 catalogue so the feed variants have something to show.
// Needs a Knock workflow with key `prototype-feed` (one In-app feed step), committed to Development.
// Run: npx tsx scripts/prototype-seed-notifications.ts
try {
  process.loadEnvFile(".env");
} catch {}

const WORKFLOW = "prototype-feed";

type N = { kind: string; title: string; body: string; url: string; actor?: string };

const ts = "/courses/introduction-to-typescript";
const seed: Record<number, { name: string; items: N[] }> = {
  // Platform Admin
  1: {
    name: "Alex Rivera",
    items: [
      { kind: "refund_requested", title: "New Refund Request", body: "Emma Wilson asked for a refund on Introduction to TypeScript ($49, Individual Purchase): “The pace was too slow for me and…”", url: "/admin/refunds", actor: "Emma Wilson" },
      { kind: "refund_requested", title: "New Refund Request", body: "Bossy McBossface asked for a refund on Building REST APIs with Node.js ($490, Team Licence): “Half the team left before…”", url: "/admin/refunds", actor: "Bossy McBossface" },
      { kind: "comment_reply", title: "Sarah Chen replied to your comment", body: "On “Primitive Types”: “Good catch, I'll re-record that section next week.”", url: `${ts}/lessons/4`, actor: "Sarah Chen" },
    ],
  },
  // Instructor
  2: {
    name: "Sarah Chen",
    items: [
      { kind: "enrollment", title: "New Enrollment", body: "Liam Thompson enrolled in Introduction to TypeScript (Individual Purchase).", url: "/instructor/1/students", actor: "Liam Thompson" },
      { kind: "course_status", title: "Course status changed", body: "Alex Rivera moved Introduction to TypeScript from Draft → Published.", url: "/instructor/1", actor: "Alex Rivera" },
      { kind: "question", title: "New question", body: "James Park on “Union and Intersection Types”: “Why does narrowing not work when the union…”", url: `${ts}/lessons/7`, actor: "James Park" },
      { kind: "refund_approved_instructor", title: "Refund approved", body: "A Refund Request on Introduction to TypeScript was approved. You lost one Enrollment.", url: "/instructor/1/students" },
      { kind: "question", title: "New question", body: "Emma Wilson on “Primitive Types”: “Is `object` the same as `{}`?”", url: `${ts}/lessons/4`, actor: "Emma Wilson" },
    ],
  },
  // Student
  5: {
    name: "Emma Wilson",
    items: [
      { kind: "new_lesson", title: "New lesson", body: "“Function Types” was added to Introduction to TypeScript.", url: `${ts}/lessons/8`, actor: "Sarah Chen" },
      { kind: "comment_reply", title: "Sarah Chen replied to your comment", body: "On “Primitive Types”: “Not quite — `{}` accepts any non-null value, while `object`…”", url: `${ts}/lessons/4`, actor: "Sarah Chen" },
      { kind: "refund_declined", title: "Refund Request declined", body: "Your Refund Request for Building REST APIs with Node.js was declined: “You've completed 80% of the course.” You can raise a new request.", url: "/courses/building-rest-apis-with-nodejs", actor: "Alex Rivera" },
      { kind: "new_lesson", title: "New lesson", body: "“Generics in Practice” was added to Introduction to TypeScript.", url: ts, actor: "Sarah Chen" },
    ],
  },
  // Team Admin (student role + team_members admin)
  10: {
    name: "Bossy McBossface",
    items: [
      { kind: "seat_claimed", title: "Seat claimed", body: "Noah Blackwood claimed a Seat on Building REST APIs with Node.js. 3 Seats left.", url: "/team", actor: "Noah Blackwood" },
      { kind: "seat_claimed", title: "Seat claimed", body: "Isla Fernandes claimed a Seat on Building REST APIs with Node.js. 2 Seats left.", url: "/team", actor: "Isla Fernandes" },
      { kind: "refund_approved", title: "Refund Request approved", body: "Your refund of $98 on Building REST APIs with Node.js was approved: “Refunded the 2 Unclaimed Seats.”", url: "/team", actor: "Alex Rivera" },
      { kind: "role_changed", title: "Your role changed", body: "Alex Rivera changed your role from Student → Instructor.", url: "/settings", actor: "Alex Rivera" },
    ],
  },
};

for (const [id, { name, items }] of Object.entries(seed)) {
  for (const data of items) {
    const res = await fetch(`https://api.knock.app/v1/workflows/${WORKFLOW}/trigger`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.KNOCK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipients: [{ id, name }], data }),
    });
    console.log(name, data.kind, res.status, res.ok ? "" : await res.text());
    if (!res.ok) process.exit(1);
    await new Promise((r) => setTimeout(r, 1200)); // distinct timestamps
  }
}
export {};
