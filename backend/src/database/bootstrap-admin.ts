import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * On first run: if no user has admin role, creates the same default admin as the dev seed (admin / admin123).
 * Credentials can be changed in the app after login — no extra env variables.
 */
export async function ensureBootstrapAdmin(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(User);

  const adminAlready = await repo.count({ where: { role: 'admin' } });
  if (adminAlready > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  await repo.save(
    repo.create({
      username: 'admin',
      email: 'admin@celkereszt.hu',
      passwordHash,
      role: 'admin',
      active: true,
    }),
  );
  console.log(
    'Default admin created: username admin, password admin123 — change the password after first login.',
  );
}
