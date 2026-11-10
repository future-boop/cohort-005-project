// PROTOTYPE — throwaway. Three Notification Feed variants for the wayfinder ticket
// "What does the Notification Feed look like in Cadence?".
// Three variants in the app layout, switchable via ?variant=A|B|C.
// Data comes from the real Knock Development feed for the DevUI-selected user.
import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Bell,
  BadgeCheck,
  Check,
  ChevronRight,
  Inbox,
  MessageSquare,
  PanelRightClose,
  PlayCircle,
  Receipt,
  Shield,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";
import type { Feed, FeedItem } from "~/lib/knock-prototype.server";

export const FEED_VARIANTS = [
  { key: "A", name: "Bell + popover" },
  { key: "B", name: "Nav item + inbox drawer" },
  { key: "C", name: "Always-on activity rail" },
];

// ─── shared bits ────────────────────────────────────────────────────────────

const kindIcon: Record<string, typeof Bell> = {
  refund_requested: Receipt,
  refund_approved: Receipt,
  refund_declined: Receipt,
  refund_approved_instructor: Receipt,
  question: MessageSquare,
  comment_reply: MessageSquare,
  new_lesson: PlayCircle,
  enrollment: UserPlus,
  course_status: Shield,
  seat_claimed: UsersRound,
  role_changed: BadgeCheck,
};

function KindIcon({ kind, className }: { kind?: string; className?: string }) {
  const Icon = (kind && kindIcon[kind]) || Bell;
  return <Icon className={cn("size-4", className)} />;
}

function useFeedActions() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  function mark(status: "seen" | "read" | "unread" | "archived", ids: string[]) {
    if (ids.length === 0) return;
    const fd = new FormData();
    fd.set("status", status);
    ids.forEach((id) => fd.append("id", id));
    fetcher.submit(fd, { method: "post", action: "/api/prototype-notifications" });
  }
  function open(item: FeedItem) {
    if (!item.read_at) mark("read", [item.id]);
    if (item.data?.url) navigate(item.data.url);
  }
  return { mark, open, busy: fetcher.state !== "idle" };
}

function FeedError({ feed }: { feed: Feed }) {
  if (!feed.error) return null;
  return (
    <div className="m-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
      PROTOTYPE: Knock feed failed. {feed.error.slice(0, 200)}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" />
      You're all caught up.
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });
}

// ─── Variant A: bell in the sidebar header, popover list ────────────────────
// Badge = UNSEEN count. Opening the popover marks everything seen (badge clears),
// but rows stay highlighted until each one is clicked (read).

export function VariantABell({ feed }: { feed: Feed }) {
  const [openPanel, setOpenPanel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { mark, open } = useFeedActions();
  useClickOutside(ref, () => setOpenPanel(false));

  function toggle() {
    const next = !openPanel;
    setOpenPanel(next);
    if (next) mark("seen", feed.entries.filter((e) => !e.seen_at).map((e) => e.id));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {feed.meta.unseen_count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
            {feed.meta.unseen_count > 9 ? "9+" : feed.meta.unseen_count}
          </span>
        )}
      </button>

      {openPanel && (
        <div className="absolute left-full top-0 z-50 ml-3 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={() => mark("read", feed.entries.filter((e) => !e.read_at).map((e) => e.id))}
              className="text-xs text-primary hover:underline disabled:opacity-40"
              disabled={feed.meta.unread_count === 0}
            >
              Mark all as read
            </button>
          </div>
          <FeedError feed={feed} />
          <div className="max-h-[28rem] overflow-y-auto">
            {feed.entries.length === 0 && <Empty />}
            {feed.entries.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setOpenPanel(false);
                  open(item);
                }}
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent",
                  !item.read_at && "bg-primary/5"
                )}
              >
                <KindIcon kind={item.data?.kind} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.data?.title}</div>
                  <div className="line-clamp-2 text-sm text-muted-foreground">{item.data?.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.inserted_at)}</div>
                </div>
                {!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variant B: "Notifications" nav item, right-hand inbox drawer ───────────
// Badge = UNREAD count (no separate "seen" idea). Unread / All tabs, grouped by day,
// per-row read toggle and archive. Feels like an inbox you work through.

export function VariantBNavItem({ feed }: { feed: Feed }) {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const { mark, open } = useFeedActions();

  const list = tab === "unread" ? feed.entries.filter((e) => !e.read_at) : feed.entries;
  const today = new Date().toDateString();
  const groups: [string, FeedItem[]][] = [
    ["Today", list.filter((e) => new Date(e.inserted_at).toDateString() === today)],
    ["Earlier", list.filter((e) => new Date(e.inserted_at).toDateString() !== today)],
  ];

  return (
    <>
      <button
        onClick={() => setOpenDrawer(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        Notifications
        {feed.meta.unread_count > 0 && (
          <span className="ml-auto rounded-full bg-primary px-2 text-xs font-semibold leading-5 text-primary-foreground">
            {feed.meta.unread_count}
          </span>
        )}
      </button>

      {openDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpenDrawer(false)}>
          <div
            className="flex h-full w-[30rem] flex-col bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button onClick={() => setOpenDrawer(false)} className="rounded p-1 hover:bg-accent" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-1 border-b px-5 py-2">
              {(["unread", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm capitalize",
                    tab === t ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {t} {t === "unread" && `(${feed.meta.unread_count})`}
                </button>
              ))}
              <button
                onClick={() => mark("read", feed.entries.filter((e) => !e.read_at).map((e) => e.id))}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            </div>
            <FeedError feed={feed} />
            <div className="flex-1 overflow-y-auto">
              {list.length === 0 && <Empty />}
              {groups.map(([label, items]) =>
                items.length === 0 ? null : (
                  <section key={label}>
                    <div className="sticky top-0 bg-muted/80 px-5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {label}
                    </div>
                    {items.map((item) => (
                      <div key={item.id} className="group flex items-start gap-3 border-b px-5 py-4 hover:bg-accent/50">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <KindIcon kind={item.data?.kind} />
                        </div>
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setOpenDrawer(false);
                            open(item);
                          }}
                        >
                          <div className={cn("text-sm", !item.read_at ? "font-semibold" : "text-muted-foreground")}>
                            {item.data?.title}
                          </div>
                          <div className="text-sm text-muted-foreground">{item.data?.body}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.inserted_at).toLocaleString()}
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            title={item.read_at ? "Mark as unread" : "Mark as read"}
                            onClick={() => mark(item.read_at ? "unread" : "read", [item.id])}
                            className="rounded p-1 hover:bg-accent"
                          >
                            <Check className="size-4" />
                          </button>
                          <button
                            title="Archive"
                            onClick={() => mark("archived", [item.id])}
                            className="rounded p-1 hover:bg-accent"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Variant C: always-on activity rail beside the page ─────────────────────
// No popover at all: the feed is a permanent column on the right, collapsible to
// a thin strip. Anything rendered in the rail counts as seen automatically;
// unread items carry a left accent bar until clicked.

export function VariantCRail({ feed }: { feed: Feed }) {
  const [collapsed, setCollapsed] = useState(false);
  const { mark, open } = useFeedActions();

  const unseenKey = feed.entries.filter((e) => !e.seen_at).map((e) => e.id).join(",");
  useEffect(() => {
    if (!collapsed && unseenKey) mark("seen", unseenKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, unseenKey]);

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-l bg-sidebar py-3">
        <button onClick={() => setCollapsed(false)} className="relative rounded p-1.5 hover:bg-sidebar-accent" aria-label="Open activity">
          <Bell className="size-5" />
          {feed.meta.unread_count > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
              {feed.meta.unread_count}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold">Activity</span>
        <div className="flex items-center gap-2">
          {feed.meta.unread_count > 0 && (
            <button
              onClick={() => mark("read", feed.entries.filter((e) => !e.read_at).map((e) => e.id))}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
          <button onClick={() => setCollapsed(true)} className="rounded p-1 hover:bg-sidebar-accent" aria-label="Collapse">
            <PanelRightClose className="size-4" />
          </button>
        </div>
      </div>
      <FeedError feed={feed} />
      <ol className="flex-1 overflow-y-auto">
        {feed.entries.length === 0 && <Empty />}
        {feed.entries.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => open(item)}
              className={cn(
                "group flex w-full items-start gap-2 border-l-2 px-3 py-2.5 text-left hover:bg-sidebar-accent",
                item.read_at ? "border-transparent opacity-70" : "border-primary"
              )}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold">
                {item.data?.actor ? item.data.actor.split(" ").map((p) => p[0]).join("") : <KindIcon kind={item.data?.kind} className="size-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-muted-foreground">
                  {item.data?.title} · {formatRelativeTime(item.inserted_at)}
                </div>
                <div className={cn("line-clamp-3 text-[13px] leading-snug", !item.read_at && "font-medium")}>
                  {item.data?.body}
                </div>
              </div>
              <ChevronRight className="mt-1 size-3.5 shrink-0 opacity-0 group-hover:opacity-60" />
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
