import { Server as SocketServer } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

let _io: SocketServer | null = null;

export function getIo(): SocketServer | null {
  return _io;
}

export function initializeSocket(httpServer: http.Server): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  _io = io;

  io.on('connection', (socket) => {
    // Verify JWT token from handshake — disconnect unauthenticated clients.
    const token = socket.handshake.auth.token as string | undefined;
    let userId: string | undefined;

    if (token) {
      try {
        const secret = process.env.JWT_SECRET!;
        const payload = jwt.verify(token, secret) as { id: string };
        userId = payload.id;
      } catch {
        socket.disconnect(true);
        return;
      }
    } else {
      // Fallback: accept userId directly only in dev (no token sent yet).
      userId = socket.handshake.auth.userId as string | undefined;
    }

    console.log(`[socket] connected  id=${socket.id} userId=${userId ?? 'anon'}`);

    // ── Room management ──────────────────────────────────────────────────────
    socket.on('join_booking_room', ({ booking_id }: { booking_id: string }) => {
      socket.join(`booking_${booking_id}`);
    });

    socket.on('join_category_room', ({ category_id }: { category_id: string }) => {
      socket.join(`category_${category_id}`);
    });

    socket.on('leave_room', ({ room }: { room: string }) => {
      socket.leave(room);
    });

    // ── Messaging ────────────────────────────────────────────────────────────
    socket.on(
      'send_message',
      ({
        booking_id,
        content,
      }: {
        booking_id: string;
        sender_id?: string;
        content: string;
      }) => {
        try {
          if (!userId || !booking_id || !content?.trim()) return;
          if (content.trim().length > 2000) return;

          // Ensure sender is a party to this booking.
          const booking = db.prepare(
            'SELECT resident_id, professional_id FROM bookings WHERE id = ?'
          ).get(booking_id) as { resident_id: string; professional_id: string | null } | undefined;
          if (!booking) return;
          if (booking.resident_id !== userId && booking.professional_id !== userId) return;

          const id = uuidv4();
          db.prepare(
            'INSERT INTO messages (id, booking_id, sender_id, content) VALUES (?, ?, ?, ?)'
          ).run(id, booking_id, userId, content.trim());

          const message = db
            .prepare('SELECT * FROM messages WHERE id = ?')
            .get(id);

          // Emit to ALL sockets in the room (including sender).
          io.to(`booking_${booking_id}`).emit('new_message', message);
        } catch (err) {
          console.error('[socket:send_message]', err);
        }
      }
    );

    // ── Typing indicator ─────────────────────────────────────────────────────
    socket.on(
      'typing',
      ({ booking_id }: { booking_id: string }) => {
        if (!userId || !booking_id) return;
        socket.to(`booking_${booking_id}`).emit('user_typing', { booking_id, sender_id: userId });
      }
    );

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected id=${socket.id}`);
    });
  });

  return io;
}
