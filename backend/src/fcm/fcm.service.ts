import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { getMessaging, MulticastMessage, Message } from 'firebase-admin/messaging';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';
import { logVerbose } from '../common/verbose-log';

/** Késlekedés mérséklése (Doze / normál háttér-prior alatti kézbesítés). */
const FCM_DELIVERY_HEADERS: Pick<MulticastMessage, 'android' | 'apns'> = {
  android: { priority: 'high' },
  apns: {
    headers: {
      'apns-priority': '10',
    },
  },
};

@Injectable()
export class FcmService implements OnModuleInit {
  private firebaseApp: App | null = null;

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
  ) {}

  onModuleInit() {
    // Only initialize Firebase if credentials are provided
    if (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        if (!getApps().length) {
          this.firebaseApp = initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
          });
          logVerbose('Firebase initialized');
        } else {
          this.firebaseApp = getApp();
        }
      } catch (error) {
        console.warn('Firebase initialization failed, FCM will not work:', error.message);
      }
    } else {
      console.warn('Firebase credentials not provided, FCM disabled');
    }
  }

  async sendToPair(
    pairId: number,
    message: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    const devices = await this.deviceRepository.find({
      where: { pairId, loggedOutAt: IsNull() },
    });

    const tokens = devices
      .map((d) => d.fcmToken)
      .filter((token) => token !== null && token !== undefined && String(token).trim() !== '');

    if (tokens.length === 0) {
      return { success: false, message: 'A párhoz nem tartozik aktív eszköz' };
    }

    const messagePayload: MulticastMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data || {},
      tokens,
      ...FCM_DELIVERY_HEADERS,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(messagePayload);
      const ok = response.successCount > 0;
      return {
        success: ok,
        successCount: response.successCount,
        failureCount: response.failureCount,
        message: ok ? undefined : 'Minden értesítés meghiúsult (ellenőrizd a Firebase / tokeneket)',
      };
    } catch (error) {
      console.error('FCM send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendToAllPairs(message: { title: string; body: string }) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    // Get all devices with FCM tokens and filter to active ones
    // Active = seen within last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Get all active devices (seen within last 30 minutes) with FCM tokens
    // Use query builder to properly handle NULL checks
    const activeDevices = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.fcmToken IS NOT NULL')
      .andWhere('device.fcmToken != :empty', { empty: '' })
      .andWhere('device.lastSeenAt IS NOT NULL')
      .andWhere('device.loggedOutAt IS NULL')
      .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .getMany();

    logVerbose(`[FCM] Found ${activeDevices.length} active devices with FCM tokens (seen within last 30 minutes)`);

    const tokens = activeDevices.map((d) => d.fcmToken).filter(Boolean);

    logVerbose(`[FCM] Extracted ${tokens.length} FCM tokens for sending to all pairs`);

    if (tokens.length === 0) {
      // Check if there are any active pairs at all
      const activePairs = await this.pairRepository.find({
        where: { active: true },
      });

      if (activePairs.length === 0) {
        console.warn(`[FCM] No active pairs found`);
        return { success: false, message: 'Nincs aktív pár. Nincs bejelentkezett eszköz.' };
      }

      // Also check how many devices have tokens but are not active
      const allDevicesWithTokens = await this.deviceRepository
        .createQueryBuilder('device')
        .where('device.fcmToken IS NOT NULL')
        .andWhere('device.fcmToken != :empty', { empty: '' })
        .getMany();
      console.warn(`[FCM] No FCM tokens found for active devices. Total devices with tokens: ${allDevicesWithTokens.length}, Active devices: ${activeDevices.length}`);
      return { success: false, message: 'Nincs aktív pár. Nincs bejelentkezett eszköz.' };
    }

    const messagePayload: MulticastMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      tokens,
      ...FCM_DELIVERY_HEADERS,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(messagePayload);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('FCM send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Admin / front üzenetbroadcast: minden kijelentkezés NÉLKÜLI eszköz, aminek van FCM tokenje.
   * (A sendToAllPairs a „utóbbi 30 percben aktív” szűrő miatt rendszeresen elveszítette a párokat.)
   */
  async sendBroadcastToAllStoredDevices(message: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    const rows = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.fcmToken IS NOT NULL')
      .andWhere("device.fcmToken != ''")
      .andWhere('device.pairId IS NOT NULL')
      .andWhere('device.loggedOutAt IS NULL')
      .getMany();

    const tokens = [...new Set(rows.map((d) => d.fcmToken).filter(Boolean))] as string[];

    logVerbose(`[FCM broadcast] Stored devices with tokens: ${tokens.length}`);

    if (tokens.length === 0) {
      return {
        success: false,
        message:
          'Jelenleg nincs olyan bejelentkezett pár (aktív alkalmazás-munkamenet), amelynek érvényes FCM tokenje lenne — az üzenetet senki sem kapja meg.',
      };
    }

    const chunkSize = 500;
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const slice = tokens.slice(i, i + chunkSize);
      const payload: MulticastMessage = {
        notification: { title: message.title, body: message.body },
        tokens: slice,
        ...FCM_DELIVERY_HEADERS,
      };
      if (message.data && Object.keys(message.data).length > 0) {
        payload.data = Object.fromEntries(
          Object.entries(message.data).map(([k, v]) => [k, String(v)]),
        );
      }
      const messagePayload = payload;
      try {
        const response = await getMessaging().sendEachForMulticast(messagePayload);
        ok += response.successCount;
        fail += response.failureCount;
      } catch (error) {
        console.error('FCM broadcast chunk error:', error);
        fail += slice.length;
      }
    }
    return {
      success: ok > 0,
      successCount: ok,
      failureCount: fail,
      message:
        ok === 0 && fail > 0
          ? 'FCM küldés sikertelen (minden token meghiúsult)'
          : undefined,
    };
  }

  /**
   * Minden aktív (utóbbi 30 percben látott) eszközre küld, kivéve egy adott pár eszközeit —
   * pl. játékterület-szabályszegés megszűnésekor a többi párnak (üldözőknek).
   */
  async sendToAllPairsExceptPair(
    excludePairId: number,
    message: { title: string; body: string },
  ) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const activeDevices = await this.deviceRepository
      .createQueryBuilder('device')
      .where('device.fcmToken IS NOT NULL')
      .andWhere('device.fcmToken != :empty', { empty: '' })
      .andWhere('device.lastSeenAt IS NOT NULL')
      .andWhere('device.loggedOutAt IS NULL')
      .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .andWhere('device.pairId IS NOT NULL')
      .andWhere('device.pairId != :excludePairId', { excludePairId })
      .getMany();

    const tokens = activeDevices.map((d) => d.fcmToken).filter(Boolean) as string[];

    if (tokens.length === 0) {
      return { success: false, message: 'Nincs cél eszköz FCM tokennel' };
    }

    const messagePayload: MulticastMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      tokens,
      ...FCM_DELIVERY_HEADERS,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(messagePayload);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('FCM send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendToDevice(
    token: string,
    message: { title: string; body: string; data?: Record<string, string>; dataOnly?: boolean },
  ) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    if (!token) {
      return { success: false, message: 'No FCM token provided' };
    }

    const messagePayload: Message = {
      data: message.data || {},
      token,
      ...FCM_DELIVERY_HEADERS,
    };
    if (!message.dataOnly && (message.title || message.body)) {
      messagePayload.notification = {
        title: message.title,
        body: message.body,
      };
    }

    try {
      const response = await getMessaging().send(messagePayload);
      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      console.error('FCM send error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

