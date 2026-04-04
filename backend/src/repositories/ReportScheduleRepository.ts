import { BaseRepository } from "./BaseRepository";

export class ReportScheduleRepository extends BaseRepository {
  async findByUserId(userId: string) {
    return this.db.reportSchedule.findUnique({ where: { userId } });
  }

  async upsert(userId: string, email: string) {
    return this.db.reportSchedule.upsert({
      where: { userId },
      create: { userId, email, active: true },
      update: { email, active: true },
    });
  }

  async deactivate(userId: string) {
    return this.db.reportSchedule.update({
      where: { userId },
      data: { active: false },
    });
  }

  async findAllActive() {
    return this.db.reportSchedule.findMany({
      where: { active: true },
      include: { user: true },
    });
  }

  async updateLastSent(id: string) {
    return this.db.reportSchedule.update({
      where: { id },
      data: { lastSent: new Date() },
    });
  }
}
