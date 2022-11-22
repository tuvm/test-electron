import { Dispatcher } from '../../src/dispatcher'

export class InMemoryDispatcher extends Dispatcher {
  public loadInitialState(): Promise<void> {
    return Promise.resolve()
  }
}
