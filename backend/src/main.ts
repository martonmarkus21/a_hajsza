import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Seed database if needed (with delay to ensure DB is ready)
  if (process.env.SEED_DB === 'true') {
    try {
      // Wait a bit for DB to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      const dataSource = app.get(DataSource);
      await seedDatabase(dataSource);
      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Database seeding error:', error);
      // Don't fail startup if seeding fails
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
