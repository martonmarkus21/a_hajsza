import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Pair } from '../entities/pair.entity';
import { Device } from '../entities/device.entity';

export async function seedDatabase(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const pairRepository = dataSource.getRepository(Pair);
  const deviceRepository = dataSource.getRepository(Device);

  // Create admin user
  const adminExists = await userRepository.findOne({ where: { username: 'admin' } });
  if (!adminExists) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = userRepository.create({
      username: 'admin',
      email: 'admin@celkereszt.hu',
      passwordHash: adminPassword,
      role: 'admin',
      active: true,
    });
    await userRepository.save(admin);
    console.log('Admin user created: admin / admin123');
  }

  // Create officer users
  for (let i = 1; i <= 3; i++) {
    const officerExists = await userRepository.findOne({ where: { username: `officer${i}` } });
    if (!officerExists) {
      const officerPassword = await bcrypt.hash(`officer${i}123`, 10);
      const officer = userRepository.create({
        username: `officer${i}`,
        email: `officer${i}@celkereszt.hu`,
        passwordHash: officerPassword,
        role: 'officer',
        active: true,
      });
      await userRepository.save(officer);
      console.log(`Officer user created: officer${i} / officer${i}123`);
    }
  }

  // Don't auto-create pairs - they should be created through admin panel
  // Only create if explicitly requested via SEED_PAIRS env var
  if (process.env.SEED_PAIRS === 'true') {
    for (let i = 1; i <= 12; i++) {
      const pairExists = await pairRepository.findOne({ where: { assignedNumber: i } });
      if (!pairExists) {
        const pair = pairRepository.create({
          assignedNumber: i,
          name: null,
          active: false, // Inactive until device logs in
        });
        await pairRepository.save(pair);
        console.log(`Pair ${i} created (inactive until device login)`);
      }
    }
  }
}


