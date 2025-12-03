import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan, SelectQueryBuilder } from 'typeorm';
import { Device } from '../entities/device.entity';
import { Pair } from '../entities/pair.entity';

@Injectable()
export class FcmService implements OnModuleInit {
  private firebaseApp: admin.app.App | null = null;

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
        if (!admin.apps.length) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
          });
          console.log('Firebase initialized');
        } else {
          this.firebaseApp = admin.app();
        }
      } catch (error) {
        console.warn('Firebase initialization failed, FCM will not work:', error.message);
      }
    } else {
      console.warn('Firebase credentials not provided, FCM disabled');
    }
  }

  async sendToPair(pairId: number, message: { title: string; body: string }) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    const devices = await this.deviceRepository.find({
      where: { pairId },
    });

    const tokens = devices
      .map((d) => d.fcmToken)
      .filter((token) => token !== null && token !== undefined);

    if (tokens.length === 0) {
      return { success: false, message: 'No FCM tokens found for pair' };
    }

    const messagePayload: admin.messaging.MulticastMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(messagePayload);
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
      .andWhere('device.lastSeenAt > :thirtyMinutesAgo', { thirtyMinutesAgo })
      .getMany();

    console.log(`[FCM] Found ${activeDevices.length} active devices with FCM tokens (seen within last 30 minutes)`);

    const tokens = activeDevices.map((d) => d.fcmToken).filter(Boolean);

    console.log(`[FCM] Extracted ${tokens.length} FCM tokens for sending to all pairs`);

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

    const messagePayload: admin.messaging.MulticastMessage = {
      notification: {
        title: message.title,
        body: message.body,
      },
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(messagePayload);
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
    message: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.firebaseApp) {
      console.warn('FCM not initialized, skipping push notification');
      return { success: false, message: 'FCM not initialized' };
    }

    if (!token) {
      return { success: false, message: 'No FCM token provided' };
    }

    const messagePayload: admin.messaging.Message = {
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data || {},
      token,
    };

    try {
      const response = await admin.messaging().send(messagePayload);
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

