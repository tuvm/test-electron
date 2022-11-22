// import { AccountsStore } from './accounts-store'
import {
  AliveStore,
  DesktopAliveEvent,
} from './alive-store'
import { setBoolean, getBoolean } from '../lib/local-storage'
// import { StatsStore } from '../stats'
import { NotificationCallback } from 'desktop-notifications/dist/notification-callback'

/**
 * The localStorage key for whether the user has enabled high-signal
 * notifications.
 */
const NotificationsEnabledKey = 'high-signal-notifications-enabled'

/** Whether or not the user has enabled high-signal notifications */
export function getNotificationsEnabled() {
  return getBoolean(NotificationsEnabledKey, true)
}

/**
 * This class manages the coordination between Alive events and actual OS-level
 * notifications.
 */
export class NotificationsStore {

  public constructor(
    // private readonly accountsStore: AccountsStore,
    private readonly aliveStore: AliveStore,
    // private readonly statsStore: StatsStore
  ) {
    this.aliveStore.setEnabled(getNotificationsEnabled())
    this.aliveStore.onAliveEventReceived(this.onAliveEventReceived)
  }

  /** Enables or disables high-signal notifications entirely. */
  public setNotificationsEnabled(enabled: boolean) {
    const previousValue = getBoolean(NotificationsEnabledKey, true)

    if (previousValue === enabled) {
      return
    }

    setBoolean(NotificationsEnabledKey, enabled)
    this.aliveStore.setEnabled(enabled)
  }

  private onAliveEventReceived = async (e: DesktopAliveEvent) =>
    this.handleAliveEvent(e, false)

  public onNotificationEventReceived: NotificationCallback<DesktopAliveEvent> =
    async (event, id, userInfo) => this.handleAliveEvent(userInfo, true)

  private async handleAliveEvent(
    e: DesktopAliveEvent,
    skipNotification: boolean
  ) {

  }

}
