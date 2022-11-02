import { UserDatabase } from '../../../src/lib/databases'

export class TestUserDatabase extends UserDatabase {
  public constructor() {
    super('TestUserDatabase')
  }

  public async reset(): Promise<void> {
    await this.delete()
    await this.open()
  }
}
