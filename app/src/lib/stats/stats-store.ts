import { StatsDatabase, ILaunchStats, IDailyMeasures } from './stats-database'
import { merge } from '../../lib/merge'
import { IUiActivityMonitor } from '../../ui/common/ui-activity-monitor'
import { Disposable } from 'event-kit'
import {
  setNumber,
  getBoolean,
  setBoolean,
} from '../local-storage'

const StatsEndpoint = 'https://central.github.com/api/usage/desktop'

/** The URL to the stats samples page. */
export const SamplesURL = 'https://desktop.github.com/usage-data/'

// const LastDailyStatsReportKey = 'last-daily-stats-report'

/** The localStorage key for whether the user has opted out. */
const StatsOptOutKey = 'stats-opt-out'

/** Have we successfully sent the stats opt-in? */
const HasSentOptInPingKey = 'has-sent-stats-opt-in-ping'

const DeviceRegisterWizardInitiatedAtKey = 'device-register-wizard-initiated-at'
const DeviceRegisterWizardCompletedAtKey = 'device-register-wizard-terminated-at'

const RepositoriesCommittedInWithoutWriteAccessKey =
  'repositories-committed-in-without-write-access'

/** How often daily stats should be submitted (i.e., 24 hours). */
// const DailyStatsReportInterval = 1000 * 60 * 60 * 24

const DefaultDailyMeasures: IDailyMeasures = {
  openShellCount: 0,
  active: false,
  suggestedStepOpenInExternalEditor: 0,
  unhandledRejectionCount: 0,
  dragStartedAndCanceledCount: 0,
  viewsCheckOnline: 0,
  checksFailedNotificationCount: 0,
  checksFailedNotificationClicked: 0,
  checksFailedDialogOpenCount: 0,
  checksFailedDialogRerunChecksCount: 0,
}

/** The store for the app's stats. */
export class StatsStore {
  private readonly db: StatsDatabase
  private readonly uiActivityMonitor: IUiActivityMonitor
  private uiActivityMonitorSubscription: Disposable | null = null

  /** Has the user opted out of stats reporting? */
  private optOut: boolean

  public constructor(db: StatsDatabase, uiActivityMonitor: IUiActivityMonitor) {
    this.db = db
    this.uiActivityMonitor = uiActivityMonitor

    const storedValue = getHasOptedOutOfStats()

    this.optOut = storedValue || false

    // If the user has set an opt out value but we haven't sent the ping yet,
    // give it a shot now.
    if (!getBoolean(HasSentOptInPingKey, false)) {
      this.sendOptInStatusPing(this.optOut, storedValue)
    }

    this.enableUiActivityMonitoring()

    window.addEventListener('unhandledrejection', async () => {
      try {
        this.recordUnhandledRejection()
      } catch (err) {
        log.error(`Failed recording unhandled rejection`, err)
      }
    })
  }

  /** Record the given launch stats. */
  public async recordLaunchStats(stats: ILaunchStats) {
    await this.db.launches.add(stats)
  }

  /**
   * Clear the stored daily stats. Not meant to be called
   * directly. Marked as public in order to enable testing
   * of a specific scenario, see stats-store-tests for more
   * detail.
   */
  public async clearDailyStats() {
    await this.db.launches.clear()
    await this.db.dailyMeasures.clear()

    // This is a one-off, and the moment we have another
    // computed daily measure we should consider refactoring
    // them into their own interface
    localStorage.removeItem(RepositoriesCommittedInWithoutWriteAccessKey)

    this.enableUiActivityMonitoring()
  }

  private enableUiActivityMonitoring() {
    if (this.uiActivityMonitorSubscription !== null) {
      return
    }

    this.uiActivityMonitorSubscription = this.uiActivityMonitor.onActivity(
      this.onUiActivity
    )
  }

  private disableUiActivityMonitoring() {
    if (this.uiActivityMonitorSubscription === null) {
      return
    }

    this.uiActivityMonitorSubscription.dispose()
    this.uiActivityMonitorSubscription = null
  }

  private async updateDailyMeasures<K extends keyof IDailyMeasures>(
    fn: (measures: IDailyMeasures) => Pick<IDailyMeasures, K>
  ): Promise<void> {
    const defaultMeasures = DefaultDailyMeasures
    await this.db.transaction('rw', this.db.dailyMeasures, async () => {
      const measures = await this.db.dailyMeasures.limit(1).first()
      const measuresWithDefaults = {
        ...defaultMeasures,
        ...measures,
      }
      const newMeasures = merge(measuresWithDefaults, fn(measuresWithDefaults))

      return this.db.dailyMeasures.put(newMeasures)
    })
  }

  /** Record that the user opened a shell. */
  public recordOpenShell(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      openShellCount: m.openShellCount + 1,
    }))
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setOptOut(
    optOut: boolean,
    userViewedPrompt: boolean
  ): Promise<void> {
    const changed = this.optOut !== optOut

    this.optOut = optOut

    const previousValue = getBoolean(StatsOptOutKey)

    setBoolean(StatsOptOutKey, optOut)

    if (changed || userViewedPrompt) {
      await this.sendOptInStatusPing(optOut, previousValue)
    }
  }

  /** Has the user opted out of stats reporting? */
  public getOptOut(): boolean {
    return this.optOut
  }

  public recordDeviceRegisterWizardInitiated() {
    setNumber(DeviceRegisterWizardInitiatedAtKey, Date.now())
    localStorage.removeItem(DeviceRegisterWizardCompletedAtKey)
  }

  public recordDeviceRegisterWizardTerminated() {
    setNumber(DeviceRegisterWizardCompletedAtKey, Date.now())
  }

  /**
   * Increment the number of times the user has opened their external editor
   * from the suggested next steps view
   */
  public recordSuggestedStepOpenInExternalEditor(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      suggestedStepOpenInExternalEditor:
        m.suggestedStepOpenInExternalEditor + 1,
    }))
  }

  private onUiActivity = async () => {
    this.disableUiActivityMonitoring()

    return this.updateDailyMeasures(m => ({
      active: true,
    }))
  }

  public recordUnhandledRejection() {
    return this.updateDailyMeasures(m => ({
      unhandledRejectionCount: m.unhandledRejectionCount + 1,
    }))
  }

  public recordDragStartedAndCanceled(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      dragStartedAndCanceledCount: m.dragStartedAndCanceledCount + 1,
    }))
  }

  public recordChecksFailedNotificationShown(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      checksFailedNotificationCount: m.checksFailedNotificationCount + 1,
    }))
  }

  public recordChecksFailedNotificationClicked(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      checksFailedNotificationClicked: m.checksFailedNotificationClicked + 1,
    }))
  }

  public recordChecksFailedDialogOpen(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      checksFailedDialogOpenCount: m.checksFailedDialogOpenCount + 1,
    }))
  }

  public recordChecksFailedDialogRerunChecks(): Promise<void> {
    return this.updateDailyMeasures(m => ({
      checksFailedDialogRerunChecksCount:
        m.checksFailedDialogRerunChecksCount + 1,
    }))
  }

  /** Post some data to our stats endpoint. */
  private post(body: object): Promise<Response> {
    const options: RequestInit = {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }

    return fetch(StatsEndpoint, options)
  }

  /**
   * Send opt-in ping with details of previous stored value (if known)
   *
   * @param optOut        Whether or not the user has opted
   *                      out of usage reporting.
   * @param previousValue The raw, current value stored for the
   *                      "stats-opt-out" localStorage key, or
   *                      undefined if no previously stored value
   *                      exists.
   */
  private async sendOptInStatusPing(
    optOut: boolean,
    previousValue: boolean | undefined
  ): Promise<void> {
    // The analytics pipeline expects us to submit `optIn` but we
    // track `optOut` so we need to invert the value before we send
    // it.
    const optIn = !optOut
    const previousOptInValue =
      previousValue === undefined ? null : !previousValue
    const direction = optIn ? 'in' : 'out'

    try {
      const response = await this.post({
        eventType: 'ping',
        optIn,
        previousOptInValue,
      })
      if (!response.ok) {
        throw new Error(
          `Unexpected status: ${response.statusText} (${response.status})`
        )
      }

      setBoolean(HasSentOptInPingKey, true)

      log.info(`Opt ${direction} reported.`)
    } catch (e) {
      log.error(`Error reporting opt ${direction}:`, e)
    }
  }
}

/**
 * Return a value indicating whether the user has opted out of stats reporting
 * or not.
 */
export function getHasOptedOutOfStats() {
  return getBoolean(StatsOptOutKey)
}
