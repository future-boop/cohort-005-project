import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  saveNote,
  toggleBookmark,
} from "./saved.server";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";
import { MAX_NOTE_LENGTH } from "./notes";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let student: number;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  student = base.user.id;

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get().id;
}

describe("bookmarking a Lesson", () => {
  it("bookmarks a Lesson that has no Bookmark", () => {
    expect(toggleBookmark(db, student, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, student, lessonIds[0])).toBe(true);
  });

  it("removes the Bookmark when toggled again", () => {
    toggleBookmark(db, student, lessonIds[0], NOW);

    expect(toggleBookmark(db, student, lessonIds[0], NOW)).toBe(false);
    expect(isBookmarked(db, student, lessonIds[0])).toBe(false);
  });

  it("never leaves a Student two Bookmarks on one Lesson", () => {
    toggleBookmark(db, student, lessonIds[0], NOW);

    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: student, lessonId: lessonIds[0] })
        .run()
    ).toThrow();
    expect(listBookmarks(db, student)).toHaveLength(1);
  });

  it("does not touch another Student's Bookmark", () => {
    const other = addStudent("Other");
    toggleBookmark(db, other, lessonIds[0], NOW);

    toggleBookmark(db, student, lessonIds[0], NOW);
    toggleBookmark(db, student, lessonIds[0], NOW);

    expect(isBookmarked(db, other, lessonIds[0])).toBe(true);
  });
});

describe("saving a Note", () => {
  it("creates a Note with the body trimmed", () => {
    const result = saveNote(db, student, lessonIds[0], "  Rewatch at 4:20  ", NOW);

    expect(result).toMatchObject({ ok: true });
    expect(getNote(db, student, lessonIds[0])).toMatchObject({
      body: "Rewatch at 4:20",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last edited time on when saved again", () => {
    saveNote(db, student, lessonIds[0], "First draft", NOW);
    saveNote(db, student, lessonIds[0], "Second draft", minutesAfter(5));

    expect(getNote(db, student, lessonIds[0])).toMatchObject({
      body: "Second draft",
      createdAt: NOW.toISOString(),
      updatedAt: minutesAfter(5).toISOString(),
    });
    expect(listNotes(db, student)).toHaveLength(1);
  });

  it("keeps Markdown characters exactly as typed", () => {
    saveNote(db, student, lessonIds[0], "# not a heading *or* emphasis", NOW);

    expect(getNote(db, student, lessonIds[0])?.body).toBe(
      "# not a heading *or* emphasis"
    );
  });

  it(`accepts a Note of exactly ${MAX_NOTE_LENGTH} characters`, () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);

    expect(saveNote(db, student, lessonIds[0], body, NOW)).toMatchObject({
      ok: true,
    });
    expect(getNote(db, student, lessonIds[0])?.body).toBe(body);
  });

  it(`refuses a Note over ${MAX_NOTE_LENGTH} characters and stores nothing`, () => {
    const body = "a".repeat(MAX_NOTE_LENGTH + 1);

    expect(saveNote(db, student, lessonIds[0], body, NOW)).toEqual({
      ok: false,
      error: `A note must be ${MAX_NOTE_LENGTH} characters or fewer.`,
    });
    expect(getNote(db, student, lessonIds[0])).toBeUndefined();
  });

  it("removes the Note when saved empty", () => {
    saveNote(db, student, lessonIds[0], "Something", NOW);

    expect(saveNote(db, student, lessonIds[0], "   ", NOW)).toEqual({
      ok: true,
      note: null,
    });
    expect(getNote(db, student, lessonIds[0])).toBeUndefined();
  });
});

describe("the Saved lists", () => {
  it("list Bookmarks newest first with their Lesson and Course", () => {
    toggleBookmark(db, student, lessonIds[0], NOW);
    toggleBookmark(db, student, lessonIds[2], minutesAfter(1));

    expect(listBookmarks(db, student)).toMatchObject([
      {
        lessonId: lessonIds[2],
        lessonTitle: "Lesson 3",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      { lessonId: lessonIds[0], lessonTitle: "Lesson 1" },
    ]);
  });

  it("list Notes by last edited time, newest first", () => {
    saveNote(db, student, lessonIds[0], "Older note", NOW);
    saveNote(db, student, lessonIds[1], "Newer note", minutesAfter(1));
    saveNote(db, student, lessonIds[0], "Older note, edited", minutesAfter(2));

    expect(listNotes(db, student)).toMatchObject([
      { lessonId: lessonIds[0], body: "Older note, edited", courseTitle: "Test Course" },
      { lessonId: lessonIds[1], body: "Newer note" },
    ]);
  });

  it("contain only the Student's own rows", () => {
    const other = addStudent("Other");
    toggleBookmark(db, other, lessonIds[0], NOW);
    saveNote(db, other, lessonIds[0], "Not yours", NOW);

    expect(listBookmarks(db, student)).toEqual([]);
    expect(listNotes(db, student)).toEqual([]);
  });
});

describe("an approved Refund", () => {
  it("keeps the Student's Bookmarks and Notes", async () => {
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: student,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: NOW.toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: student, courseId: base.course.id })
      .run();
    const admin = db
      .insert(schema.users)
      .values({ name: "Pat Admin", email: "pat@example.com", role: UserRole.Admin })
      .returning()
      .get();

    toggleBookmark(db, student, lessonIds[0], NOW);
    saveNote(db, student, lessonIds[0], "Keep me", NOW);

    const notifications = fakeNotifications();
    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      student,
      "It was not what I expected.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      admin.id,
      null,
      NOW,
      notifications
    );
    expect(approved).toMatchObject({ ok: true });

    const enrollment = db
      .select()
      .from(schema.enrollments)
      .where(eq(schema.enrollments.userId, student))
      .get();
    expect(enrollment).toBeUndefined();
    expect(isBookmarked(db, student, lessonIds[0])).toBe(true);
    expect(getNote(db, student, lessonIds[0])?.body).toBe("Keep me");
  });
});
