import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { getCorsOriginConfig } from '../shared/utils/cors-origins.util';

const wsCors = getCorsOriginConfig();

@WebSocketGateway({
  cors: {
    origin: wsCors.origin === '*' ? true : wsCors.origin,
    credentials: wsCors.credentials,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger('WebSocket');

  @WebSocketServer() server: Server;

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: any) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emit(event: string, data: any) {
    this.logger.log(`Send message. Event: ${event}. Data: `, data);
    this.server.emit(event, data);
  }
}