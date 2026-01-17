import { NextRequest, NextResponse } from "next/server";

// In-memory storage for notifications (would use database in production)
const notifications: NotificationRecord[] = [];

interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  workflowId?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

// GET /api/inbox - List all notifications
export async function GET() {
  try {
    // Sort by timestamp descending (newest first)
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return NextResponse.json({ notifications: sorted });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST /api/inbox - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, description, workflowId, sourceId, metadata } = body;

    if (!type || !title) {
      return NextResponse.json(
        { error: "Type and title are required" },
        { status: 400 }
      );
    }

    const notification: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      description: description || "",
      timestamp: new Date().toISOString(),
      read: false,
      workflowId,
      sourceId,
      metadata,
    };

    notifications.unshift(notification);

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

// PATCH /api/inbox - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, markAll } = body;

    if (markAll) {
      notifications.forEach((n) => (n.read = true));
    } else if (ids && Array.isArray(ids)) {
      ids.forEach((id: string) => {
        const notification = notifications.find((n) => n.id === id);
        if (notification) notification.read = true;
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// DELETE /api/inbox - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");

    if (clearAll === "true") {
      notifications.length = 0;
    } else if (id) {
      const index = notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        notifications.splice(index, 1);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
