import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { logVerbose } from '../common/verbose-log';

@WSGateway({
  namespace: '/ws/game',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (token) {
        try {
          const payload = this.jwtService.verify(token);
          client.data.user = payload;
          logVerbose(`Client connected: ${client.id} (${payload.username || payload.deviceId || 'unknown'})`);
          // Auto-subscribe to positions for authenticated users
          client.join('positions');
        } catch (jwtError) {
          console.error('WebSocket JWT verification error:', jwtError);
          // Don't disconnect, allow connection but without auth
          logVerbose(`Client connected with invalid token: ${client.id}`);
        }
      } else {
        logVerbose(`Client connected without auth: ${client.id}`);
        // Allow connection without auth for public events
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      // Don't disconnect on error, allow connection
    }
  }

  handleDisconnect(client: Socket) {
    logVerbose(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:positions')
  handleSubscribePositions(@ConnectedSocket() client: Socket) {
    client.join('positions');
    return { success: true };
  }

  @SubscribeMessage('unsubscribe:positions')
  handleUnsubscribePositions(@ConnectedSocket() client: Socket) {
    client.leave('positions');
    return { success: true };
  }

  broadcastPositionUpdate(data: any) {
    this.server.to('positions').emit('positionUpdate', data);
  }

  broadcastDistanceUpdate(data: any) {
    this.server.to('positions').emit('distanceUpdate', data);
  }

  broadcastCapture(data: any) {
    this.server.emit('capture', data);
  }

  broadcastMwHighlight(data: any) {
    this.server.emit('mwHighlight', data);
  }

  broadcastGeofenceAlert(data: any) {
    this.server.emit('geofenceAlert', data);
  }

  broadcastRuleViolation(data: any) {
    this.server.emit('ruleViolation', data);
  }

  broadcastPairStatusUpdate(data: any) {
    this.server.emit('pairStatusUpdate', data);
  }

  broadcastGameAreaUpdate(data: any) {
    this.server.emit('gameAreaUpdate', data);
  }

  /** Új, adatbázisba mentett GPS-minta (admin pozíciók lista élő frissítéséhez). */
  broadcastSavedPositionSample(data: { pairId: number; id: number }) {
    this.server.emit('savedPositionSample', data);
  }

  /** Admin törlés után: minden kliens frissítse a mentett pozíciók listáját. */
  broadcastSavedPositionsDeleted(data: { pairId: number; deleted: number }) {
    this.server.emit('savedPositionsDeleted', data);
  }
}
