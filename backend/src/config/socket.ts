import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { Officer, type OfficerRole } from '../models/Officer.js';
import type {
  ClusterCategory,
  ClusterLegacyRiskLevel,
  ClusterRiskColor,
  ClusterRiskStatus,
  ClusterStatus,
} from '../models/Cluster.js';
import type { IGeoPoint, IGeoPolygon } from '../models/GeoJSON.js';
import type { ReportAgeGroup, ReportSeverity, ReportStatus } from '../models/Report.js';
import { verifyOfficerToken, type JwtOfficerPayload } from '../utils/jwt.js';

export const SOCKET_EVENTS = {
  CONNECTION_AUTHENTICATED: 'connection:authenticated',
  REPORT_NEW: 'report:new',
  CLUSTER_DETECTED: 'cluster:detected',
  CLUSTER_UPDATED: 'cluster:updated',
} as const;

export const SOCKET_ROOMS = {
  ALL_OFFICERS: 'officers',
  byRole: (role: OfficerRole): string => `role:${role}`,
  byKelurahan: (kelurahanId: string): string => `kelurahan:${kelurahanId}`,
} as const;

export interface AuthenticatedSocketOfficer extends JwtOfficerPayload {
  name?: string;
  assignedKelurahan?: string;
}

export interface ConnectionAuthenticatedSocketPayload {
  socketId: string;
  officer: {
    officerId: string;
    name?: string;
    email: string;
    role: OfficerRole;
    nip: string;
    assignedKelurahan?: string;
  };
  rooms: string[];
  connectedAt: string;
}

export interface NewReportSocketPayload {
  event: typeof SOCKET_EVENTS.REPORT_NEW;
  isUpdated: boolean;
  report: {
    id: string;
    reporterName: string;
    category: string;
    symptoms: string[];
    sickCount: number;
    age: number;
    ageGroups: ReportAgeGroup[];
    severity: ReportSeverity;
    status: ReportStatus;
    geom: IGeoPoint;
    address?: string;
    kelurahanId?: string;
    reportedAt: string;
  };
  emittedAt: string;
}

export interface SocketClusterItem {
  id: string;
  clusterCode: string;
  category: ClusterCategory;
  kelurahanId?: string;
  center: IGeoPoint;
  boundary?: IGeoPolygon;
  radiusMeters: number;
  reportCount: number;
  totalSickCount: number;
  averageAqi?: number;
  dominantSymptoms: string[];
  riskStatus: ClusterRiskStatus;
  riskColor: ClusterRiskColor;
  colorHex: string;
  riskLevel: ClusterLegacyRiskLevel;
  status: ClusterStatus;
  assignedOfficerId?: string;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface ClusterDetectedSocketPayload {
  event: typeof SOCKET_EVENTS.CLUSTER_DETECTED;
  clustersDetected: number;
  clustersByCategory: {
    ispa: number;
    diare: number;
  };
  upsertedClusterIds: string[];
  resolvedStaleCount: number;
  clusters: SocketClusterItem[];
  detectedAt: string;
}

export interface ClusterUpdatedSocketPayload {
  event: typeof SOCKET_EVENTS.CLUSTER_UPDATED;
  clusterId: string;
  clusterCode: string;
  previousStatus: ClusterStatus;
  status: ClusterStatus;
  riskStatus: ClusterRiskStatus;
  riskLevel: ClusterLegacyRiskLevel;
  assignedOfficerId?: string;
  updatedBy?: {
    officerId: string;
    email: string;
    role: OfficerRole;
  };
  cluster: SocketClusterItem;
  updatedAt: string;
}

export interface SocketServerToClientEvents {
  [SOCKET_EVENTS.CONNECTION_AUTHENTICATED]: (
    payload: ConnectionAuthenticatedSocketPayload
  ) => void;
  [SOCKET_EVENTS.REPORT_NEW]: (payload: NewReportSocketPayload) => void;
  [SOCKET_EVENTS.CLUSTER_DETECTED]: (payload: ClusterDetectedSocketPayload) => void;
  [SOCKET_EVENTS.CLUSTER_UPDATED]: (payload: ClusterUpdatedSocketPayload) => void;
}

export interface SocketClientToServerEvents {
  'ping:dashboard': (callback?: (res: { pong: true; timestamp: string }) => void) => void;
}

export interface SocketInterServerEvents {
  ping: () => void;
}

export interface SocketData {
  officer?: AuthenticatedSocketOfficer;
}

export type RespiraSocket = Socket<
  SocketClientToServerEvents,
  SocketServerToClientEvents,
  SocketInterServerEvents,
  SocketData
>;

export type RespiraSocketServer = SocketIOServer<
  SocketClientToServerEvents,
  SocketServerToClientEvents,
  SocketInterServerEvents,
  SocketData
>;

let ioInstance: RespiraSocketServer | null = null;

export const extractHandshakeToken = (socket: RespiraSocket): string | null => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    const trimmed = authToken.trim();
    return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
  }

  const authHeader = socket.handshake.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    const trimmed = authHeader.trim();
    if (trimmed.startsWith('Bearer ')) {
      const tokenPart = trimmed.slice(7).trim();
      if (tokenPart.length > 0) {
        return tokenPart;
      }
    } else {
      return trimmed;
    }
  }

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
    const trimmed = queryToken.trim();
    return trimmed.startsWith('Bearer ') ? trimmed.slice(7).trim() : trimmed;
  }

  return null;
};

export const initSocketServer = (httpServer: HttpServer): RespiraSocketServer => {
  if (ioInstance) {
    return ioInstance;
  }

  const corsOrigin = process.env.CORS_ORIGIN || '*';

  const io: RespiraSocketServer = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket: RespiraSocket, next) => {
    try {
      const token = extractHandshakeToken(socket);
      if (!token) {
        return next(
          new Error(
            'UNAUTHORIZED: Token autentikasi JWT wajib disertakan pada saat handshake (auth.token atau header Authorization).'
          )
        );
      }

      const payload = await verifyOfficerToken(token);
      if (!payload || !payload.officerId) {
        return next(new Error('UNAUTHORIZED: Payload token JWT tidak valid.'));
      }

      const officerDoc = await Officer.findById(payload.officerId)
        .select('_id name email role nip assignedKelurahan isActive')
        .lean();

      if (!officerDoc) {
        return next(new Error('UNAUTHORIZED: Akun petugas tidak ditemukan.'));
      }

      if (!officerDoc.isActive) {
        return next(new Error('FORBIDDEN: Akun petugas sedang dinonaktifkan.'));
      }

      socket.data.officer = {
        ...payload,
        officerId: officerDoc._id.toString(),
        email: officerDoc.email,
        role: officerDoc.role,
        nip: officerDoc.nip,
        name: officerDoc.name,
        ...(officerDoc.assignedKelurahan
          ? { assignedKelurahan: officerDoc.assignedKelurahan.toString() }
          : {}),
      };

      return next();
    } catch {
      return next(
        new Error('UNAUTHORIZED: Token JWT tidak valid atau telah kedaluwarsa.')
      );
    }
  });

  io.on('connection', (socket: RespiraSocket) => {
    const officer = socket.data.officer;
    if (!officer) {
      socket.disconnect(true);
      return;
    }

    const joinedRooms: string[] = [
      SOCKET_ROOMS.ALL_OFFICERS,
      SOCKET_ROOMS.byRole(officer.role),
    ];

    void socket.join(SOCKET_ROOMS.ALL_OFFICERS);
    void socket.join(SOCKET_ROOMS.byRole(officer.role));

    if (officer.assignedKelurahan) {
      const kelRoom = SOCKET_ROOMS.byKelurahan(officer.assignedKelurahan);
      joinedRooms.push(kelRoom);
      void socket.join(kelRoom);
    }

    console.log(
      `[Socket.io] Petugas terhubung: ${officer.email} (${officer.role}) | Socket ID: ${socket.id}`
    );

    socket.emit(SOCKET_EVENTS.CONNECTION_AUTHENTICATED, {
      socketId: socket.id,
      officer: {
        officerId: officer.officerId,
        ...(officer.name ? { name: officer.name } : {}),
        email: officer.email,
        role: officer.role,
        nip: officer.nip,
        ...(officer.assignedKelurahan
          ? { assignedKelurahan: officer.assignedKelurahan }
          : {}),
      },
      rooms: joinedRooms,
      connectedAt: new Date().toISOString(),
    });

    socket.on('ping:dashboard', (callback) => {
      if (typeof callback === 'function') {
        callback({
          pong: true,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket.io] Petugas terputus: ${officer.email} | Socket ID: ${socket.id} | Alasan: ${reason}`
      );
    });
  });

  ioInstance = io;
  console.log('[Socket.io] WebSocket server siap menerima koneksi terautentikasi JWT.');
  return io;
};

export const getSocketServer = (): RespiraSocketServer | null => ioInstance;

export const emitNewReport = (payload: NewReportSocketPayload): void => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(SOCKET_ROOMS.ALL_OFFICERS).emit(SOCKET_EVENTS.REPORT_NEW, payload);
  console.log(
    `[Socket.io] Broadcast "${SOCKET_EVENTS.REPORT_NEW}" -> reportId=${payload.report.id} (${payload.report.category})`
  );
};

export const emitClusterDetected = (payload: ClusterDetectedSocketPayload): void => {
  if (!ioInstance) {
    return;
  }

  ioInstance
    .to(SOCKET_ROOMS.ALL_OFFICERS)
    .emit(SOCKET_EVENTS.CLUSTER_DETECTED, payload);
  console.log(
    `[Socket.io] Broadcast "${SOCKET_EVENTS.CLUSTER_DETECTED}" -> ${payload.clustersDetected} klaster aktif`
  );
};

export const emitClusterUpdated = (payload: ClusterUpdatedSocketPayload): void => {
  if (!ioInstance) {
    return;
  }

  ioInstance
    .to(SOCKET_ROOMS.ALL_OFFICERS)
    .emit(SOCKET_EVENTS.CLUSTER_UPDATED, payload);
  console.log(
    `[Socket.io] Broadcast "${SOCKET_EVENTS.CLUSTER_UPDATED}" -> ${payload.clusterCode} (${payload.previousStatus} -> ${payload.status})`
  );
};
