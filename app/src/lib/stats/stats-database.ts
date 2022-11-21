import Dexie from 'dexie'

// NB: This _must_ be incremented whenever the DB key scheme changes.
const DatabaseVersion = 2

/** The timing stats for app launch. */
export interface ILaunchStats {
  /**
   * The time (in milliseconds) it takes from when our main process code is
   * first loaded until the app `ready` event is emitted.
   */
  readonly mainReadyTime: number

  /**
   * The time (in milliseconds) it takes from when loading begins to loading
   * end.
   */
  readonly loadTime: number

  /**
   * The time (in milliseconds) it takes from when our renderer process code is
   * first loaded until the renderer `ready` event is emitted.
   */
  readonly rendererReadyTime: number
}

/** The daily measures captured for stats. */
export interface IDailyMeasures {
  /** The ID in the database. */
  readonly id?: number

  /** The number of times the user has opened a shell from the app. */
  readonly openShellCount: number

  /** Whether or not the app has been interacted with during the current reporting window */
  readonly active: boolean

  /**
   * The number of times the user has opened their external editor from the
   * suggested next steps view
   */
  readonly suggestedStepOpenInExternalEditor: number

  /** Number of times the user has encountered an unhandled rejection */
  readonly unhandledRejectionCount: number

  /** The number of times a drag operation was started and canceled */
  readonly dragStartedAndCanceledCount: number

  /** The number of times the user clicks link to view a check online */
  readonly viewsCheckOnline: number

  /** The number of "checks failed" notifications the user received */
  readonly checksFailedNotificationCount: number

  /** The number of "checks failed" notifications the user clicked */
  readonly checksFailedNotificationClicked: number

  /** The number of times the "checks failed" dialog was opened */
  readonly checksFailedDialogOpenCount: number

  /**
   * The number of times the user decided to re-run the checks from the "checks
   * failed" dialog.
   */
  readonly checksFailedDialogRerunChecksCount: number

}

export class StatsDatabase extends Dexie {
  public declare launches: Dexie.Table<ILaunchStats, number>
  public declare dailyMeasures: Dexie.Table<IDailyMeasures, number>

  public constructor(name: string) {
    super(name)

    this.version(1).stores({
      launches: '++',
    })

    this.version(DatabaseVersion).stores({
      dailyMeasures: '++id',
    })
  }
}
