import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'development' && process.env.SEED_DB === 'true') {
      console.log('Seeding database...');
      await seedDatabase(this.dataSource);
    }
  }
}






