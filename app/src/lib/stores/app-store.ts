import {
  AccountsStore,
  CloningRepositoriesStore,
  GitHubUserStore,
  SignInStore,
} from '.'
import { Account } from '../../models/account'
import { AppMenu } from '../../models/app-menu'
import {
  ImageDiffType,
} from '../../models/diff'

import { Popup } from '../../models/popup'
// import { getAppPath } from '../../ui/lib/app-proxy'
import {
  ApplicableTheme,
  ApplicationTheme,
  ICustomTheme,
} from '../../ui/lib/application-theme'
import {
  getAppMenu,
  getCurrentWindowState,
  getCurrentWindowZoomFactor,
  updateAccounts,
  setWindowZoomFactor,
} from '../../ui/main-process-proxy'
import {
  API,
  getAccountForEndpoint,
} from '../api'
import {
  Foldout,
  IAppState,
  IConstrainedValue,
} from '../app-state'

import { updateMenuState } from '../menu-update'

import {
  Default as DefaultShell,
} from '../shells'
import { StatsStore } from '../stats'
import { hasShownWelcomeFlow } from '../welcome'
import { WindowState } from '../window-state'
import { TypedBaseStore } from './base-store'
// import { readEmoji } from '../read-emoji'
import {
  setNumber,
  setBoolean,
  getBoolean,
  getFloatNumber,
} from '../local-storage'

import { Banner } from '../../models/banner'
import {
  defaultUncommittedChangesStrategy,
} from '../../models/uncommitted-changes-strategy'
import {
  TutorialStep,
} from '../../models/tutorial-step'

import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'

import { EndpointToken } from '../endpoint-token'

import * as ipcRenderer from '../ipc-renderer'

const defaultSidebarWidth: number = 250

const askToMoveToApplicationsFolderDefault: boolean = true
const confirmRepoRemovalDefault: boolean = true
const confirmDiscardChangesDefault: boolean = true
const confirmDiscardChangesPermanentlyDefault: boolean = true
const confirmDiscardStashDefault: boolean = true
const askForConfirmationOnForcePushDefault = true
const confirmUndoCommitDefault: boolean = true

const imageDiffTypeDefault = ImageDiffType.TwoUp

const hideWhitespaceInChangesDiffDefault = false
const hideWhitespaceInHistoryDiffDefault = false
const hideWhitespaceInPullRequestDiffDefault = false
const commitSpellcheckEnabledDefault = true

const repositoryIndicatorsEnabledKey = 'enable-repository-indicators'

export class AppStore extends TypedBaseStore<IAppState> {

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()


  /** The background fetcher for the currently selected repository. */



  private showWelcomeFlow = false
  private currentPopup: Popup | null = null
  private currentFoldout: Foldout | null = null
  private currentBanner: Banner | null = null
  private errors: ReadonlyArray<Error> = new Array<Error>()
  private emitQueued = false

  /** Map from shortcut (e.g., :+1:) to on disk URL. */
  private emoji = new Map<string, string>()

  /**
   * The Application menu as an AppMenu instance or null if
   * the main process has not yet provided the renderer with
   * a copy of the application menu structure.
   */
  private appMenu: AppMenu | null = null

  /**
   * Used to highlight access keys throughout the app when the
   * Alt key is pressed. Only applicable on non-macOS platforms.
   */
  private highlightAccessKeys: boolean = false

  /**
   * A value indicating whether or not the current application
   * window has focus.
   */
  private appIsFocused: boolean = false

  private sidebarWidth = constrain(defaultSidebarWidth)

  private windowState: WindowState | null = null
  private windowZoomFactor: number = 1
  private isUpdateAvailableBannerVisible: boolean = false
  private isUpdateShowcaseVisible: boolean = false

  private askToMoveToApplicationsFolderSetting: boolean =
    askToMoveToApplicationsFolderDefault
  private askForConfirmationOnRepositoryRemoval: boolean =
    confirmRepoRemovalDefault
  private confirmDiscardChanges: boolean = confirmDiscardChangesDefault
  private confirmDiscardChangesPermanently: boolean =
    confirmDiscardChangesPermanentlyDefault
  private confirmDiscardStash: boolean = confirmDiscardStashDefault
  private askForConfirmationOnForcePush = askForConfirmationOnForcePushDefault
  private confirmUndoCommit: boolean = confirmUndoCommitDefault
  private imageDiffType: ImageDiffType = imageDiffTypeDefault
  private hideWhitespaceInChangesDiff: boolean =
    hideWhitespaceInChangesDiffDefault
  private hideWhitespaceInHistoryDiff: boolean =
    hideWhitespaceInHistoryDiffDefault
  private hideWhitespaceInPullRequestDiff: boolean =
    hideWhitespaceInPullRequestDiffDefault
  /** Whether or not the spellchecker is enabled for commit summary and description */
  private commitSpellcheckEnabled: boolean = commitSpellcheckEnabledDefault

  private uncommittedChangesStrategy = defaultUncommittedChangesStrategy

  private selectedExternalEditor: string | null = null

  private resolvedExternalEditor: string | null = null

  /** The user's preferred shell. */
  private selectedShell = DefaultShell

  /** The current repository filter text */
  private repositoryFilterText: string = ''

  private selectedTheme = ApplicationTheme.System
  private customTheme?: ICustomTheme
  private currentTheme: ApplicableTheme = ApplicationTheme.Light

  private useWindowsOpenSSH: boolean = false

  private repositoryIndicatorsEnabled: boolean

  /** Which step the user needs to complete next in the onboarding tutorial */
  private currentOnboardingTutorialStep = TutorialStep.NotApplicable

  private currentDragElement: DragElement | null = null
  private lastThankYou: ILastThankYou | undefined
  private showCIStatusPopover: boolean = false

  public constructor(
    private readonly gitHubUserStore: GitHubUserStore,
    private readonly cloningRepositoriesStore: CloningRepositoriesStore,
    private readonly statsStore: StatsStore,
    private readonly signInStore: SignInStore,
    private readonly accountsStore: AccountsStore,
  ) {
    super()

    this.showWelcomeFlow = !hasShownWelcomeFlow()

    this.initializeWindowState()
    this.initializeZoomFactor()
    this.wireupIpcEventHandlers()
    this.wireupStoreEventHandlers()
    getAppMenu()

    // We're considering flipping the default value and have new users
    // start off with repository indicators disabled. As such we'll start
    // persisting the current default to localstorage right away so we
    // can change the default in the future without affecting current
    // users.
    if (getBoolean(repositoryIndicatorsEnabledKey) === undefined) {
      setBoolean(repositoryIndicatorsEnabledKey, true)
    }

    this.repositoryIndicatorsEnabled =
      getBoolean(repositoryIndicatorsEnabledKey) ?? true

    API.onTokenInvalidated(this.onTokenInvalidated)

  }

  private initializeWindowState = async () => {
    const currentWindowState = await getCurrentWindowState()
    if (currentWindowState === undefined) {
      return
    }

    this.windowState = currentWindowState
  }

  private initializeZoomFactor = async () => {
    const zoomFactor = await this.getWindowZoomFactor()
    if (zoomFactor === undefined) {
      return
    }
    this.onWindowZoomFactorChanged(zoomFactor)
  }

  /**
   * On Windows OS, whenever a user toggles their zoom factor, chromium stores it
   * in their `%AppData%/Roaming/GitHub Desktop/Preferences.js` denoted by the
   * file path to the application. That file path contains the apps version.
   * Thus, on every update, the users set zoom level gets reset as there is not
   * defined value for the current app version.
   * */
  private async getWindowZoomFactor() {
    const zoomFactor = await getCurrentWindowZoomFactor()
    // One is the default value, we only care about checking the locally stored
    // value if it is one because that is the default value after an
    // update
    if (zoomFactor !== 1 || !__WIN32__) {
      return zoomFactor
    }

    const locallyStoredZoomFactor = getFloatNumber('zoom-factor')
    if (
      locallyStoredZoomFactor !== undefined &&
      locallyStoredZoomFactor !== zoomFactor
    ) {
      setWindowZoomFactor(locallyStoredZoomFactor)
      return locallyStoredZoomFactor
    }

    return zoomFactor
  }

  private onTokenInvalidated = (endpoint: string) => {
    const account = getAccountForEndpoint(this.accounts, endpoint)

    if (account === null) {
      return
    }

    // If there is a currently open popup, don't do anything here. Since the
    // app can only show one popup at a time, we don't want to close the current
    // one in favor of the error we're about to show.
    if (this.currentPopup !== null) {
      return
    }

  }

  private wireupIpcEventHandlers() {
    ipcRenderer.on('window-state-changed', (_, windowState) => {
      this.windowState = windowState
      this.emitUpdate()
    })

    ipcRenderer.on('zoom-factor-changed', (event: any, zoomFactor: number) => {
      this.onWindowZoomFactorChanged(zoomFactor)
    })

    ipcRenderer.on('app-menu', (_, menu) => this.setAppMenu(menu))
  }

  private wireupStoreEventHandlers() {
    this.gitHubUserStore.onDidUpdate(() => {
      this.emitUpdate()
    })

    this.cloningRepositoriesStore.onDidUpdate(() => {
      this.emitUpdate()
    })

    this.cloningRepositoriesStore.onDidError(e => this.emitError(e))

    this.signInStore.onDidAuthenticate((account, method) => {
      // this._addAccount(account)

      if (this.showWelcomeFlow) {
        this.statsStore.recordWelcomeWizardSignInMethod(method)
      }
    })
    this.signInStore.onDidUpdate(() => this.emitUpdate())
    this.signInStore.onDidError(error => this.emitError(error))

    this.accountsStore.onDidUpdate(accounts => {
      this.accounts = accounts
      const endpointTokens = accounts.map<EndpointToken>(
        ({ endpoint, token }) => ({ endpoint, token })
      )

      updateAccounts(endpointTokens)

      this.emitUpdate()
    })
    this.accountsStore.onDidError(error => this.emitError(error))
  }

  /** Load the emoji from disk. */
  // public async loadEmoji() {
  //   const rootDir = await getAppPath()
  //   readEmoji(rootDir)
  //     .then(emoji => {
  //       this.emoji = emoji
  //       this.emitUpdate()
  //     })
  //     .catch(err => {
  //       log.warn(`Unexpected issue when trying to read emoji into memory`, err)
  //     })
  // }

  protected emitUpdate() {
    // If the window is hidden then we won't get an animation frame, but there
    // may still be work we wanna do in response to the state change. So
    // immediately emit the update.
    if (this.windowState === 'hidden') {
      this.emitUpdateNow()
      return
    }

    if (this.emitQueued) {
      return
    }

    this.emitQueued = true

    window.requestAnimationFrame(() => {
      this.emitUpdateNow()
    })
  }

  private emitUpdateNow() {
    this.emitQueued = false
    const state = this.getState()

    super.emitUpdate(state)
    updateMenuState(state, this.appMenu)
  }

  /**
   * Called when we have reason to suspect that the zoom factor
   * has changed. Note that this doesn't necessarily mean that it
   * has changed with regards to our internal state which is why
   * we double check before emitting an update.
   */
  private onWindowZoomFactorChanged(zoomFactor: number) {
    const current = this.windowZoomFactor
    this.windowZoomFactor = zoomFactor

    if (zoomFactor !== current) {
      setNumber('zoom-factor', zoomFactor)
      this.emitUpdate()
    }
  }

  public getState(): any {

    return {
      userList: this.userList,
      accounts: this.accounts,
      windowState: this.windowState,
      windowZoomFactor: this.windowZoomFactor,
      appIsFocused: this.appIsFocused,
      currentPopup: this.currentPopup,
      currentFoldout: this.currentFoldout,
      errors: this.errors,
      showWelcomeFlow: this.showWelcomeFlow,
      emoji: this.emoji,
      sidebarWidth: this.sidebarWidth,
      appMenuState: this.appMenu ? this.appMenu.openMenus : [],
      highlightAccessKeys: this.highlightAccessKeys,
      isUpdateAvailableBannerVisible: this.isUpdateAvailableBannerVisible,
      isUpdateShowcaseVisible: this.isUpdateShowcaseVisible,
      currentBanner: this.currentBanner,
      askToMoveToApplicationsFolderSetting:
        this.askToMoveToApplicationsFolderSetting,
      askForConfirmationOnRepositoryRemoval:
        this.askForConfirmationOnRepositoryRemoval,
      askForConfirmationOnDiscardChanges: this.confirmDiscardChanges,
      askForConfirmationOnDiscardChangesPermanently:
        this.confirmDiscardChangesPermanently,
      askForConfirmationOnDiscardStash: this.confirmDiscardStash,
      askForConfirmationOnForcePush: this.askForConfirmationOnForcePush,
      askForConfirmationOnUndoCommit: this.confirmUndoCommit,
      uncommittedChangesStrategy: this.uncommittedChangesStrategy,
      selectedExternalEditor: this.selectedExternalEditor,
      imageDiffType: this.imageDiffType,
      hideWhitespaceInChangesDiff: this.hideWhitespaceInChangesDiff,
      hideWhitespaceInHistoryDiff: this.hideWhitespaceInHistoryDiff,
      hideWhitespaceInPullRequestDiff: this.hideWhitespaceInPullRequestDiff,
      selectedShell: this.selectedShell,
      repositoryFilterText: this.repositoryFilterText,
      resolvedExternalEditor: this.resolvedExternalEditor,
      selectedTheme: this.selectedTheme,
      customTheme: this.customTheme,
      currentTheme: this.currentTheme,
      useWindowsOpenSSH: this.useWindowsOpenSSH,
      optOutOfUsageTracking: this.statsStore.getOptOut(),
      currentOnboardingTutorialStep: this.currentOnboardingTutorialStep,
      repositoryIndicatorsEnabled: this.repositoryIndicatorsEnabled,
      commitSpellcheckEnabled: this.commitSpellcheckEnabled,
      currentDragElement: this.currentDragElement,
      lastThankYou: this.lastThankYou,
      showCIStatusPopover: this.showCIStatusPopover,
    }
  }

  private setAppMenu(menu: any): Promise<void> {
    if (this.appMenu) {
      this.appMenu = this.appMenu.withMenu(menu)
    } else {
      this.appMenu = AppMenu.fromMenu(menu)
    }

    this.emitUpdate()
    return Promise.resolve()
  }
}

function constrain(
  value: IConstrainedValue | number,
  min = -Infinity,
  max = Infinity
): IConstrainedValue {
  return { value: typeof value === 'number' ? value : value.value, min, max }
}
