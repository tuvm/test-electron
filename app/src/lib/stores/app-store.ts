import {
  AccountsStore,
  DeviceRegisterStore,
} from '.'
import { Account } from '../../models/account'
import { AppMenu, IMenu } from '../../models/app-menu'
// import {
//   ImageDiffType,
// } from '../../models/diff'
// import { PullRequest } from '../../models/pull-request'
// import {
//   ILocalRepositoryState,
//   Repository,
//   RepositoryWithGitHubRepository,
// } from '../../models/repository'

import { Popup, PopupType } from '../../models/popup'
import { themeChangeMonitor } from '../../ui/common/theme-change-monitor'
// import { getAppPath } from '../../ui/lib/app-proxy'
import {
  ApplicationTheme,
  getPersistedThemeName,
  ICustomTheme,
  setPersistedTheme,
} from '../../ui/common/application-theme'
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
  getEndpointForRepository,
} from '../api'
import { shell } from '../app-shell'
import {
  Foldout,
  FoldoutType,
  IAppState,
  IConstrainedValue,
} from '../app-state'
import {
  findEditorOrDefault,
  launchExternalEditor,
} from '../editors'

// import { getAccountForRepository } from '../get-account-for-repository'
// import {
//   installGlobalLFSFilters,
//   // installLFSHooks,
// } from '../git/lfs'
import { updateMenuState } from '../menu-update'
import {
  Default as DefaultShell,
  findShellOrDefault,
  launchShell,
  parse as parseShell,
  Shell,
} from '../shells'
import { ILaunchStats, StatsStore } from '../stats'
// import { hasShownWelcomeFlow, markWelcomeFlowComplete } from '../welcome'
import { hasShownDeviceRegisterFlow, markDeviceRegisterFlowComplete } from '../device-register'
import { WindowState } from '../window-state'
import { TypedBaseStore } from './base-store'
// import { RepositoryStateCache } from './repository-state-cache'
// import { readEmoji } from '../read-emoji'
import {
  setNumber,
  setBoolean,
  getBoolean,
  getNumber,
  // getEnum,
  getObject,
  setObject,
  getFloatNumber,
} from '../local-storage'
import { ExternalEditorError, suggestedExternalEditor } from '../editors/shared'
import { ApiRepositoriesStore } from './api-repositories-store'
import { Banner, BannerType } from '../../models/banner'
// import {
//   UncommittedChangesStrategy,
//   defaultUncommittedChangesStrategy,
// } from '../../models/uncommitted-changes-strategy'
// import {
//   TutorialStep,
// } from '../../models/tutorial-step'
import { parseRemote } from '../../lib/remote-parsing'
import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'
// import { UseWindowsOpenSSHKey } from '../ssh/ssh'
import { clamp } from '../clamp'
import { EndpointToken } from '../endpoint-token'
import {
  NotificationsStore,
  getNotificationsEnabled,
} from './notifications-store'
import * as ipcRenderer from '../ipc-renderer'

const defaultSidebarWidth: number = 250
const sidebarWidthConfigKey: string = 'sidebar-width'

// const defaultCommitSummaryWidth: number = 250
// const commitSummaryWidthConfigKey: string = 'commit-summary-width'

// const defaultStashedFilesWidth: number = 250
// const stashedFilesWidthConfigKey: string = 'stashed-files-width'

// const defaultPullRequestFileListWidth: number = 250
// const pullRequestFileListConfigKey: string = 'pull-request-files-width'

const askToMoveToApplicationsFolderDefault: boolean = true
// const confirmRepoRemovalDefault: boolean = true
// const confirmDiscardChangesDefault: boolean = true
// const confirmDiscardChangesPermanentlyDefault: boolean = true
// const confirmDiscardStashDefault: boolean = true
// const askForConfirmationOnForcePushDefault = true
// const confirmUndoCommitDefault: boolean = true
const askToMoveToApplicationsFolderKey: string = 'askToMoveToApplicationsFolder'
// const confirmRepoRemovalKey: string = 'confirmRepoRemoval'
// const confirmDiscardChangesKey: string = 'confirmDiscardChanges'
// const confirmDiscardStashKey: string = 'confirmDiscardStash'
// const confirmDiscardChangesPermanentlyKey: string =
//   'confirmDiscardChangesPermanentlyKey'
// const confirmForcePushKey: string = 'confirmForcePush'
// const confirmUndoCommitKey: string = 'confirmUndoCommit'

// const uncommittedChangesStrategyKey = 'uncommittedChangesStrategyKind'

// const imageDiffTypeDefault = ImageDiffType.TwoUp
// const imageDiffTypeKey = 'image-diff-type'

// const hideWhitespaceInChangesDiffDefault = false
// const hideWhitespaceInChangesDiffKey = 'hide-whitespace-in-changes-diff'
// const hideWhitespaceInHistoryDiffDefault = false
// const hideWhitespaceInHistoryDiffKey = 'hide-whitespace-in-diff'
// const hideWhitespaceInPullRequestDiffDefault = false
// const hideWhitespaceInPullRequestDiffKey =
//   'hide-whitespace-in-pull-request-diff'

// const commitSpellcheckEnabledDefault = true
// const commitSpellcheckEnabledKey = 'commit-spellcheck-enabled'

const shellKey = 'shell'

const repositoryIndicatorsEnabledKey = 'enable-repository-indicators'

const lastThankYouKey = 'version-and-users-of-last-thank-you'
const customThemeKey = 'custom-theme-key'
export class AppStore extends TypedBaseStore<IAppState> {
  // private readonly gitStoreCache: GitStoreCache

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()
  // private repositories: ReadonlyArray<Repository> = new Array<Repository>()
  private recentRepositories: ReadonlyArray<number> = new Array<number>()

  // private showWelcomeFlow = false
  private showDeviceRegisterFlow = false
  // private focusCommitMessage = false
  private currentPopup: Popup | null = null
  private currentFoldout: Foldout | null = null
  private currentBanner: Banner | null = null
  private errors: ReadonlyArray<Error> = new Array<Error>()
  private emitQueued = false

  // private readonly localRepositoryStateLookup = new Map<
  //   number,
  //   ILocalRepositoryState
  // >()

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
  // private commitSummaryWidth = constrain(defaultCommitSummaryWidth)
  // private stashedFilesWidth = constrain(defaultStashedFilesWidth)
  // private pullRequestFileListWidth = constrain(defaultPullRequestFileListWidth)

  private windowState: WindowState | null = null
  private windowZoomFactor: number = 1
  private isUpdateAvailableBannerVisible: boolean = false
  private isUpdateShowcaseVisible: boolean = false

  private askToMoveToApplicationsFolderSetting: boolean =
    askToMoveToApplicationsFolderDefault
  // private askForConfirmationOnRepositoryRemoval: boolean =
  //   confirmRepoRemovalDefault
  // private confirmDiscardChanges: boolean = confirmDiscardChangesDefault
  // private confirmDiscardChangesPermanently: boolean =
  //   confirmDiscardChangesPermanentlyDefault
  // private confirmDiscardStash: boolean = confirmDiscardStashDefault
  // private askForConfirmationOnForcePush = askForConfirmationOnForcePushDefault
  // private confirmUndoCommit: boolean = confirmUndoCommitDefault
  // private imageDiffType: ImageDiffType = imageDiffTypeDefault
  // private hideWhitespaceInChangesDiff: boolean =
  //   hideWhitespaceInChangesDiffDefault
  // private hideWhitespaceInHistoryDiff: boolean =
  //   hideWhitespaceInHistoryDiffDefault
  // private hideWhitespaceInPullRequestDiff: boolean =
  //   hideWhitespaceInPullRequestDiffDefault
  /** Whether or not the spellchecker is enabled for commit summary and description */
  // private commitSpellcheckEnabled: boolean = commitSpellcheckEnabledDefault
  // private showSideBySideDiff: boolean = ShowSideBySideDiffDefault

  // private uncommittedChangesStrategy = defaultUncommittedChangesStrategy

  private selectedExternalEditor: string | null = null

  private resolvedExternalEditor: string | null = null

  /** The user's preferred shell. */
  private selectedShell = DefaultShell

  /** The current repository filter text */
  private repositoryFilterText: string = ''

  // /** The function to resolve the current Open in Desktop flow. */
  // private resolveOpenInDesktop:
  //   | ((repository: Repository | null) => void)
  //   | null = null

  private selectedTheme = ApplicationTheme.System
  private customTheme?: ICustomTheme
  private currentTheme: ApplicationTheme = ApplicationTheme.Light

  private useWindowsOpenSSH: boolean = false

  private repositoryIndicatorsEnabled: boolean

  /** Which step the user needs to complete next in the onboarding tutorial */
  // private currentOnboardingTutorialStep = TutorialStep.NotApplicable

  private currentDragElement: DragElement | null = null
  private lastThankYou: ILastThankYou | undefined
  private showCIStatusPopover: boolean = false

  public constructor(
    // private readonly gitHubUserStore: GitHubUserStore,
    // private readonly cloningRepositoriesStore: CloningRepositoriesStore,
    // private readonly issuesStore: IssuesStore,
    private readonly statsStore: StatsStore,
    private readonly deviceRegisterStore: DeviceRegisterStore,
    private readonly accountsStore: AccountsStore,
    // private readonly repositoriesStore: RepositoriesStore,
    // private readonly pullRequestCoordinator: PullRequestCoordinator,
    // private readonly repositoryStateCache: RepositoryStateCache,
    private readonly apiRepositoriesStore: ApiRepositoriesStore,
    private readonly notificationsStore: NotificationsStore
  ) {
    super()

    // this.showWelcomeFlow = !hasShownWelcomeFlow()
    this.showDeviceRegisterFlow = !hasShownDeviceRegisterFlow()

    // if (__WIN32__) {
    //   const useWindowsOpenSSH = getBoolean(UseWindowsOpenSSHKey)

    //   // If the user never selected whether to use Windows OpenSSH or not, use it
    //   // by default if we have to show the welcome flow (i.e. if it's a new install)
    //   if (useWindowsOpenSSH === undefined) {
    //     this._setUseWindowsOpenSSH(this.showWelcomeFlow)
    //   } else {
    //     this.useWindowsOpenSSH = useWindowsOpenSSH
    //   }
    // }

    window.addEventListener('resize', () => {
      this.updateResizableConstraints()
      this.emitUpdate()
    })

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

    // If the token was invalidated for an account, sign out from that account
    this._removeAccount(account)

    this._showPopup({
      type: PopupType.InvalidatedToken,
      account,
    })
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
    // this.gitHubUserStore.onDidUpdate(() => {
    //   this.emitUpdate()
    // })

    this.accountsStore.onDidUpdate(accounts => {
      this.accounts = accounts
      const endpointTokens = accounts.map<EndpointToken>(
        ({ endpoint, token }) => ({ endpoint, token })
      )

      updateAccounts(endpointTokens)

      this.emitUpdate()
    })
    this.accountsStore.onDidError(error => this.emitError(error))

    this.apiRepositoriesStore.onDidUpdate(() => this.emitUpdate())
    this.apiRepositoriesStore.onDidError(error => this.emitError(error))
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
      this.updateResizableConstraints()
      this.emitUpdate()
    }
  }

  public getState(): IAppState {
    return {
      userList: this.userList,
      accounts: this.accounts,
      recentRepositories: this.recentRepositories,
      // localRepositoryStateLookup: this.localRepositoryStateLookup,
      windowState: this.windowState,
      windowZoomFactor: this.windowZoomFactor,
      appIsFocused: this.appIsFocused,
      deviceRegisterState: this.deviceRegisterStore.getState(),
      currentPopup: this.currentPopup,
      currentFoldout: this.currentFoldout,
      errors: this.errors,
      // showWelcomeFlow: this.showWelcomeFlow,
      showDeviceRegisterFlow: this.showDeviceRegisterFlow,
      // focusCommitMessage: this.focusCommitMessage,
      emoji: this.emoji,
      sidebarWidth: this.sidebarWidth,
      // commitSummaryWidth: this.commitSummaryWidth,
      // stashedFilesWidth: this.stashedFilesWidth,
      // pullRequestFilesListWidth: this.pullRequestFileListWidth,
      appMenuState: this.appMenu ? this.appMenu.openMenus : [],
      highlightAccessKeys: this.highlightAccessKeys,
      isUpdateAvailableBannerVisible: this.isUpdateAvailableBannerVisible,
      isUpdateShowcaseVisible: this.isUpdateShowcaseVisible,
      currentBanner: this.currentBanner,
      askToMoveToApplicationsFolderSetting:
        this.askToMoveToApplicationsFolderSetting,
      // askForConfirmationOnRepositoryRemoval:
      //   this.askForConfirmationOnRepositoryRemoval,
      // askForConfirmationOnDiscardChanges: this.confirmDiscardChanges,
      // askForConfirmationOnDiscardChangesPermanently:
      //   this.confirmDiscardChangesPermanently,
      // askForConfirmationOnDiscardStash: this.confirmDiscardStash,
      // askForConfirmationOnForcePush: this.askForConfirmationOnForcePush,
      // askForConfirmationOnUndoCommit: this.confirmUndoCommit,
      // uncommittedChangesStrategy: this.uncommittedChangesStrategy,
      selectedExternalEditor: this.selectedExternalEditor,
      // imageDiffType: this.imageDiffType,
      // hideWhitespaceInChangesDiff: this.hideWhitespaceInChangesDiff,
      // hideWhitespaceInHistoryDiff: this.hideWhitespaceInHistoryDiff,
      // hideWhitespaceInPullRequestDiff: this.hideWhitespaceInPullRequestDiff,
      // showSideBySideDiff: this.showSideBySideDiff,
      selectedShell: this.selectedShell,
      repositoryFilterText: this.repositoryFilterText,
      resolvedExternalEditor: this.resolvedExternalEditor,
      selectedTheme: this.selectedTheme,
      customTheme: this.customTheme,
      currentTheme: this.currentTheme,
      apiRepositories: this.apiRepositoriesStore.getState(),
      useWindowsOpenSSH: this.useWindowsOpenSSH,
      optOutOfUsageTracking: this.statsStore.getOptOut(),
      // currentOnboardingTutorialStep: this.currentOnboardingTutorialStep,
      repositoryIndicatorsEnabled: this.repositoryIndicatorsEnabled,
      // commitSpellcheckEnabled: this.commitSpellcheckEnabled,
      currentDragElement: this.currentDragElement,
      lastThankYou: this.lastThankYou,
      showCIStatusPopover: this.showCIStatusPopover,
      notificationsEnabled: getNotificationsEnabled(),
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setRepositoryFilterText(text: string): Promise<void> {
    this.repositoryFilterText = text
    this.emitUpdate()
  }

  public async fetchPullRequest(repoUrl: string, pr: string) {
    const endpoint = getEndpointForRepository(repoUrl)
    const account = getAccountForEndpoint(this.accounts, endpoint)

    if (account) {
      const api = API.fromAccount(account)
      const remoteUrl = parseRemote(repoUrl)
      if (remoteUrl && remoteUrl.owner && remoteUrl.name) {
        return await api.fetchPullRequest(remoteUrl.owner, remoteUrl.name, pr)
      }
    }
    return null
  }

  private getUserList = async () => {
    const res = await fetch('https://reqres.in/api/users?page=2');
    const data = await res.json();
    return data;
  }

  /** Load the initial state for the app. */
  public async loadInitialState() {
    const [accounts, userList] = await Promise.all([
      this.accountsStore.getAll(),
      this.getUserList(),
    ])

    accounts.forEach(a => {
      log.info(`[AppStore] found account: ${a.login} (${a.name})`)
    })

    this.accounts = accounts
    this.userList = userList

    this.sidebarWidth = constrain(
      getNumber(sidebarWidthConfigKey, defaultSidebarWidth)
    )
    // this.commitSummaryWidth = constrain(
    //   getNumber(commitSummaryWidthConfigKey, defaultCommitSummaryWidth)
    // )
    // this.stashedFilesWidth = constrain(
    //   getNumber(stashedFilesWidthConfigKey, defaultStashedFilesWidth)
    // )
    // this.pullRequestFileListWidth = constrain(
    //   getNumber(pullRequestFileListConfigKey, defaultPullRequestFileListWidth)
    // )

    this.updateResizableConstraints()
    // TODO: Initiliaze here for now... maybe move to dialog mounting
    // this.updatePullRequestResizableConstraints()

    this.askToMoveToApplicationsFolderSetting = getBoolean(
      askToMoveToApplicationsFolderKey,
      askToMoveToApplicationsFolderDefault
    )

    // this.askForConfirmationOnRepositoryRemoval = getBoolean(
    //   confirmRepoRemovalKey,
    //   confirmRepoRemovalDefault
    // )

    // this.confirmDiscardChanges = getBoolean(
    //   confirmDiscardChangesKey,
    //   confirmDiscardChangesDefault
    // )

    // this.confirmDiscardChangesPermanently = getBoolean(
    //   confirmDiscardChangesPermanentlyKey,
    //   confirmDiscardChangesPermanentlyDefault
    // )

    // this.confirmDiscardStash = getBoolean(
    //   confirmDiscardStashKey,
    //   confirmDiscardStashDefault
    // )

    // this.askForConfirmationOnForcePush = getBoolean(
    //   confirmForcePushKey,
    //   askForConfirmationOnForcePushDefault
    // )

    // this.confirmUndoCommit = getBoolean(
    //   confirmUndoCommitKey,
    //   confirmUndoCommitDefault
    // )

    // this.uncommittedChangesStrategy =
    //   getEnum(uncommittedChangesStrategyKey, UncommittedChangesStrategy) ??
    //   defaultUncommittedChangesStrategy

    const shellValue = localStorage.getItem(shellKey)
    this.selectedShell = shellValue ? parseShell(shellValue) : DefaultShell

    // const imageDiffTypeValue = localStorage.getItem(imageDiffTypeKey)
    // this.imageDiffType =
    //   imageDiffTypeValue === null
    //     ? imageDiffTypeDefault
    //     : parseInt(imageDiffTypeValue)

    // this.hideWhitespaceInChangesDiff = getBoolean(
    //   hideWhitespaceInChangesDiffKey,
    //   false
    // )
    // this.hideWhitespaceInHistoryDiff = getBoolean(
    //   hideWhitespaceInHistoryDiffKey,
    //   false
    // )
    // this.hideWhitespaceInPullRequestDiff = getBoolean(
    //   hideWhitespaceInPullRequestDiffKey,
    //   false
    // )
    // this.commitSpellcheckEnabled = getBoolean(
    //   commitSpellcheckEnabledKey,
    //   commitSpellcheckEnabledDefault
    // )
    // this.showSideBySideDiff = getShowSideBySideDiff()

    this.selectedTheme = getPersistedThemeName()
    this.customTheme = getObject<ICustomTheme>(customThemeKey)
    // Make sure the persisted theme is applied
    setPersistedTheme(this.selectedTheme)

    this.currentTheme = this.selectedTheme

    themeChangeMonitor.onThemeChanged(theme => {
      this.currentTheme = theme
      this.emitUpdate()
    })

    this.lastThankYou = getObject<ILastThankYou>(lastThankYouKey)

    this.emitUpdateNow()

    this.accountsStore.refresh()
  }

  /**
   * Calculate the constraints of our resizable panes whenever the window
   * dimensions change.
   */
  private updateResizableConstraints() {
    // The combined width of the branch dropdown and the push pull fetch button
    // Since the repository list toolbar button width is tied to the width of
    // the sidebar we can't let it push the branch, and push/pull/fetch buttons
    // off screen.
    const toolbarButtonsWidth = 460

    // Start with all the available width
    let available = window.innerWidth

    // Working our way from left to right (i.e. giving priority to the leftmost
    // pane when we need to constrain the width)
    //
    // 220 was determined as the minimum value since it is the smallest width
    // that will still fit the placeholder text in the branch selector textbox
    // of the history tab
    const maxSidebarWidth = available - toolbarButtonsWidth
    this.sidebarWidth = constrain(this.sidebarWidth, 220, maxSidebarWidth)

    // Now calculate the width we have left to distribute for the other panes
    available -= clamp(this.sidebarWidth)

    // This is a pretty silly width for a diff but it will fit ~9 chars per line
    // in unified mode after subtracting the width of the unified gutter and ~4
    // chars per side in split diff mode. No one would want to use it this way
    // but it doesn't break the layout and it allows users to temporarily
    // maximize the width of the file list to see long path names.
    // const diffPaneMinWidth = 150
    // const filesMax = available - diffPaneMinWidth

    // this.commitSummaryWidth = constrain(this.commitSummaryWidth, 100, filesMax)
    // this.stashedFilesWidth = constrain(this.stashedFilesWidth, 100, filesMax)
  }

  /**
   * Calculate the constraints of the resizable pane in the pull request dialog
   * whenever the window dimensions change.
   */
  // private updatePullRequestResizableConstraints() {
  //   // TODO: Get width of PR dialog -> determine if we will have default width
  //   // for pr dialog. The goal is for it expand to fill some percent of
  //   // available window so it will change on window resize. We may have some max
  //   // value and min value of where to derive a default is we cannot obtain the
  //   // width for some reason (like initialization nad no pr dialog is open)
  //   // Thoughts -> ß
  //   // 1. Use dialog id to grab dialog if exists, else use default
  //   // 2. Pass dialog width up when and call this contrainst on dialog mounting
  //   //    to initialize and subscribe to window resize inside dialog to be able
  //   //    to pass up dialog width on window resize.

  //   // Get the width of the dialog
  //   const available = 850
  //   const dialogPadding = 20

  //   // This is a pretty silly width for a diff but it will fit ~9 chars per line
  //   // in unified mode after subtracting the width of the unified gutter and ~4
  //   // chars per side in split diff mode. No one would want to use it this way
  //   // but it doesn't break the layout and it allows users to temporarily
  //   // maximize the width of the file list to see long path names.
  //   const diffPaneMinWidth = 150
  //   const filesListMax = available - dialogPadding - diffPaneMinWidth

  //   this.pullRequestFileListWidth = constrain(
  //     this.pullRequestFileListWidth,
  //     100,
  //     filesListMax
  //   )
  // }

  // public _setCommitSpellcheckEnabled(commitSpellcheckEnabled: boolean) {
  //   if (this.commitSpellcheckEnabled === commitSpellcheckEnabled) {
  //     return
  //   }

  //   setBoolean(commitSpellcheckEnabledKey, commitSpellcheckEnabled)
  //   this.commitSpellcheckEnabled = commitSpellcheckEnabled

  //   this.emitUpdate()
  // }

  // public _setUseWindowsOpenSSH(useWindowsOpenSSH: boolean) {
  //   setBoolean(UseWindowsOpenSSHKey, useWindowsOpenSSH)
  //   this.useWindowsOpenSSH = useWindowsOpenSSH

  //   this.emitUpdate()
  // }

  public _setNotificationsEnabled(notificationsEnabled: boolean) {
    this.notificationsStore.setNotificationsEnabled(notificationsEnabled)
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _showPopup(popup: Popup): Promise<void> {
    this._closePopup()

    // Always close the app menu when showing a pop up. This is only
    // applicable on Windows where we draw a custom app menu.
    this._closeFoldout(FoldoutType.AppMenu)

    this.currentPopup = popup
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _closePopup(popupType?: PopupType) {
    const currentPopup = this.currentPopup
    if (currentPopup == null) {
      return
    }

    if (popupType !== undefined && currentPopup.type !== popupType) {
      return
    }

    // if (currentPopup.type === PopupType.CloneRepository) {
    //   this._completeOpenInDesktop(() => Promise.resolve(null))
    // }

    this.currentPopup = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _showFoldout(foldout: Foldout): Promise<void> {
    this.currentFoldout = foldout
    this.emitUpdate()

    // If the user is opening the repository list and we haven't yet
    // started to refresh the repository indicators let's do so.
    if (
      foldout.type === FoldoutType.Repository &&
      this.repositoryIndicatorsEnabled
    ) {
      // N.B: RepositoryIndicatorUpdater.prototype.start is
      // idempotent.
      // this.repositoryIndicatorUpdater.start()
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _closeCurrentFoldout(): Promise<void> {
    if (this.currentFoldout == null) {
      return
    }

    this.currentFoldout = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _closeFoldout(foldout: FoldoutType): Promise<void> {
    if (this.currentFoldout == null) {
      return
    }

    if (foldout !== undefined && this.currentFoldout.type !== foldout) {
      return
    }

    this.currentFoldout = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _pushError(error: Error): Promise<void> {
    const newErrors = Array.from(this.errors)
    newErrors.push(error)
    this.errors = newErrors
    this.emitUpdate()

    return Promise.resolve()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _clearError(error: Error): Promise<void> {
    this.errors = this.errors.filter(e => e !== error)
    this.emitUpdate()

    return Promise.resolve()
  }

  // public _endWelcomeFlow(): Promise<void> {
  //   this.showWelcomeFlow = false
  //   this.emitUpdate()

  //   markWelcomeFlowComplete()

  //   this.statsStore.recordWelcomeWizardTerminated()

  //   return Promise.resolve()
  // }

  // public _setCommitMessageFocus(focus: boolean) {
  //   if (this.focusCommitMessage !== focus) {
  //     this.focusCommitMessage = focus
  //     this.emitUpdate()
  //   }
  // }

  public _setSidebarWidth(width: number): Promise<void> {
    this.sidebarWidth = { ...this.sidebarWidth, value: width }
    setNumber(sidebarWidthConfigKey, width)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public _resetSidebarWidth(): Promise<void> {
    this.sidebarWidth = { ...this.sidebarWidth, value: defaultSidebarWidth }
    localStorage.removeItem(sidebarWidthConfigKey)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  // public _setCommitSummaryWidth(width: number): Promise<void> {
  //   this.commitSummaryWidth = { ...this.commitSummaryWidth, value: width }
  //   setNumber(commitSummaryWidthConfigKey, width)
  //   this.updateResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _resetCommitSummaryWidth(): Promise<void> {
  //   this.commitSummaryWidth = {
  //     ...this.commitSummaryWidth,
  //     value: defaultCommitSummaryWidth,
  //   }
  //   localStorage.removeItem(commitSummaryWidthConfigKey)
  //   this.updateResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  /**
   * Set the global application menu.
   *
   * This is called in response to the main process emitting an event signalling
   * that the application menu has changed in some way like an item being
   * added/removed or an item having its visibility toggled.
   *
   * This method should not be called by the renderer in any other circumstance
   * than as a directly result of the main-process event.
   *
   */
  private setAppMenu(menu: IMenu): Promise<void> {
    if (this.appMenu) {
      this.appMenu = this.appMenu.withMenu(menu)
    } else {
      this.appMenu = AppMenu.fromMenu(menu)
    }

    this.emitUpdate()
    return Promise.resolve()
  }

  public _setAppMenuState(
    update: (appMenu: AppMenu) => AppMenu
  ): Promise<void> {
    if (this.appMenu) {
      this.appMenu = update(this.appMenu)
      this.emitUpdate()
    }
    return Promise.resolve()
  }

  public _setAccessKeyHighlightState(highlight: boolean): Promise<void> {
    if (this.highlightAccessKeys !== highlight) {
      this.highlightAccessKeys = highlight
      this.emitUpdate()
    }

    return Promise.resolve()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _openShell(path: string) {
    this.statsStore.recordOpenShell()

    try {
      const match = await findShellOrDefault(this.selectedShell)
      await launchShell(match, path, error => this._pushError(error))
    } catch (error) {
      this.emitError(error)
    }
  }

  /** Takes a URL and opens it using the system default application */
  public _openInBrowser(url: string): Promise<boolean> {
    return shell.openExternal(url)
  }

  /** Open a path to a repository or file using the user's configured editor */
  public async _openInExternalEditor(fullPath: string): Promise<void> {
    const { selectedExternalEditor } = this.getState()

    try {
      const match = await findEditorOrDefault(selectedExternalEditor)
      if (match === null) {
        this.emitError(
          new ExternalEditorError(
            `No suitable editors installed for GitHub Desktop to launch. Install ${suggestedExternalEditor.name} for your platform and restart GitHub Desktop to try again.`,
            { suggestDefaultEditor: true }
          )
        )
        return
      }

      await launchExternalEditor(fullPath, match)
    } catch (error) {
      this.emitError(error)
    }
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setStatsOptOut(
    optOut: boolean,
    userViewedPrompt: boolean
  ): Promise<void> {
    await this.statsStore.setOptOut(optOut, userViewedPrompt)

    this.emitUpdate()
  }

  public _setAskToMoveToApplicationsFolderSetting(
    value: boolean
  ): Promise<void> {
    this.askToMoveToApplicationsFolderSetting = value

    setBoolean(askToMoveToApplicationsFolderKey, value)
    this.emitUpdate()

    return Promise.resolve()
  }

  // public _setConfirmRepositoryRemovalSetting(
  //   confirmRepoRemoval: boolean
  // ): Promise<void> {
  //   this.askForConfirmationOnRepositoryRemoval = confirmRepoRemoval
  //   setBoolean(confirmRepoRemovalKey, confirmRepoRemoval)

  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setConfirmDiscardChangesSetting(value: boolean): Promise<void> {
  //   this.confirmDiscardChanges = value

  //   setBoolean(confirmDiscardChangesKey, value)
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setConfirmDiscardChangesPermanentlySetting(
  //   value: boolean
  // ): Promise<void> {
  //   this.confirmDiscardChangesPermanently = value

  //   setBoolean(confirmDiscardChangesPermanentlyKey, value)
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setConfirmDiscardStashSetting(value: boolean): Promise<void> {
  //   this.confirmDiscardStash = value

  //   setBoolean(confirmDiscardStashKey, value)
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setConfirmForcePushSetting(value: boolean): Promise<void> {
  //   this.askForConfirmationOnForcePush = value
  //   setBoolean(confirmForcePushKey, value)

  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setConfirmUndoCommitSetting(value: boolean): Promise<void> {
  //   this.confirmUndoCommit = value
  //   setBoolean(confirmUndoCommitKey, value)

  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setUncommittedChangesStrategySetting(
  //   value: UncommittedChangesStrategy
  // ): Promise<void> {
  //   this.uncommittedChangesStrategy = value

  //   localStorage.setItem(uncommittedChangesStrategyKey, value)

  //   this.emitUpdate()
  //   return Promise.resolve()
  // }

  public _setShell(shell: Shell): Promise<void> {
    this.selectedShell = shell
    localStorage.setItem(shellKey, shell)
    this.emitUpdate()

    return Promise.resolve()
  }

  // public _changeImageDiffType(type: ImageDiffType): Promise<void> {
  //   this.imageDiffType = type
  //   localStorage.setItem(imageDiffTypeKey, JSON.stringify(this.imageDiffType))
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _setShowSideBySideDiff(showSideBySideDiff: boolean) {
  //   if (showSideBySideDiff !== this.showSideBySideDiff) {
  //     setShowSideBySideDiff(showSideBySideDiff)
  //     this.showSideBySideDiff = showSideBySideDiff
  //     this.statsStore.recordDiffModeChanged()
  //     this.emitUpdate()
  //   }
  // }

  public _setUpdateBannerVisibility(visibility: boolean) {
    this.isUpdateAvailableBannerVisible = visibility

    this.emitUpdate()
  }

  public _setUpdateShowCaseVisibility(visibility: boolean) {
    this.isUpdateShowcaseVisible = visibility

    this.emitUpdate()
  }

  public _setBanner(state: Banner) {
    this.currentBanner = state
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _clearBanner(bannerType?: BannerType) {
    const { currentBanner } = this
    if (currentBanner === null) {
      return
    }

    if (bannerType !== undefined && currentBanner.type !== bannerType) {
      return
    }

    this.currentBanner = null
    this.emitUpdate()
  }

  // public _reportStats() {
  //   return this.statsStore.reportStats(this.accounts, this.repositories)
  // }

  public _recordLaunchStats(stats: ILaunchStats): Promise<void> {
    return this.statsStore.recordLaunchStats(stats)
  }

  public async _setAppFocusState(isFocused: boolean): Promise<void> {
    if (this.appIsFocused !== isFocused) {
      this.appIsFocused = isFocused
      this.emitUpdate()
    }
  }

  // /**
  //  * Start an Open in Desktop flow. This will return a new promise which will
  //  * resolve when `_completeOpenInDesktop` is called.
  //  */
  // public _startOpenInDesktop(fn: () => void): Promise<Repository | null> {
  //   const p = new Promise<Repository | null>(
  //     resolve => (this.resolveOpenInDesktop = resolve)
  //   )
  //   fn()
  //   return p
  // }

  // /**
  //  * Complete any active Open in Desktop flow with the repository returned by
  //  * the given function.
  //  */
  // public async _completeOpenInDesktop(
  //   fn: () => Promise<Repository | null>
  // ): Promise<Repository | null> {
  //   const resolve = this.resolveOpenInDesktop
  //   this.resolveOpenInDesktop = null

  //   const result = await fn()
  //   if (resolve) {
  //     resolve(result)
  //   }

  //   return result
  // }

  public _removeAccount(account: Account): Promise<void> {
    log.info(
      `[AppStore] removing account ${account.login} (${account.name}) from store`
    )
    return this.accountsStore.removeAccount(account)
  }

  // public async _installGlobalLFSFilters(force: boolean): Promise<void> {
  //   try {
  //     await installGlobalLFSFilters(force)
  //   } catch (error) {
  //     this.emitError(error)
  //   }
  // }

  // public async _installLFSHooks(
  //   repositories: ReadonlyArray<Repository>
  // ): Promise<void> {
  //   for (const repo of repositories) {
  //     try {
  //       // At this point we've asked the user if we should install them, so
  //       // force installation.
  //       await installLFSHooks(repo, true)
  //     } catch (error) {
  //       this.emitError(error)
  //     }
  //   }
  // }

  /**
   * Request a refresh of the list of repositories that
   * the provided account has explicit permissions to access.
   * See ApiRepositoriesStore for more details.
   */
  public _refreshApiRepositories(account: Account) {
    return this.apiRepositoriesStore.loadRepositories(account)
  }

  // public async _showGitHubExplore(repository: Repository): Promise<void> {
  //   const { gitHubRepository } = repository
  //   if (!gitHubRepository || gitHubRepository.htmlURL === null) {
  //     return
  //   }

  //   const url = new URL(gitHubRepository.htmlURL)
  //   url.pathname = '/explore'

  //   await this._openInBrowser(url.toString())
  // }

  // public async _showPullRequestByPR(pr: PullRequest): Promise<void> {
  //   const { htmlURL: baseRepoUrl } = pr.base.gitHubRepository

  //   if (baseRepoUrl === null) {
  //     return
  //   }

  //   const showPrUrl = `${baseRepoUrl}/pull/${pr.pullRequestNumber}`

  //   await this._openInBrowser(showPrUrl)
  // }

  // private getIgnoreExistingUpstreamRemoteKey(repository: Repository): string {
  //   return `repository/${repository.id}/ignoreExistingUpstreamRemote`
  // }

  // public _ignoreExistingUpstreamRemote(repository: Repository): Promise<void> {
  //   const key = this.getIgnoreExistingUpstreamRemoteKey(repository)
  //   setBoolean(key, true)

  //   return Promise.resolve()
  // }

  /**
   * Set the application-wide theme
   */
  public _setSelectedTheme(theme: ApplicationTheme) {
    setPersistedTheme(theme)
    this.selectedTheme = theme
    this.currentTheme = theme
    this.emitUpdate()

    return Promise.resolve()
  }

  /**
   * Set the custom application-wide theme
   */
  public _setCustomTheme(theme: ICustomTheme) {
    setObject(customThemeKey, theme)
    this.customTheme = theme
    this.emitUpdate()

    return Promise.resolve()
  }

  public getResolvedExternalEditor = () => {
    return this.resolvedExternalEditor
  }

  // /** This shouldn't be called directly. See `Dispatcher`. */
  // public _setStashedFilesWidth(width: number): Promise<void> {
  //   this.stashedFilesWidth = { ...this.stashedFilesWidth, value: width }
  //   setNumber(stashedFilesWidthConfigKey, width)
  //   this.updateResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _resetStashedFilesWidth(): Promise<void> {
  //   this.stashedFilesWidth = {
  //     ...this.stashedFilesWidth,
  //     value: defaultStashedFilesWidth,
  //   }
  //   localStorage.removeItem(stashedFilesWidthConfigKey)
  //   this.updateResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public async _showCreateForkDialog(
  //   repository: RepositoryWithGitHubRepository
  // ) {
  //   const account = getAccountForRepository(this.accounts, repository)
  //   if (account === null) {
  //     return
  //   }
  //   await this._showPopup({
  //     type: PopupType.CreateFork,
  //     repository,
  //     account,
  //   })
  // }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setDragElement(dragElement: DragElement | null): Promise<void> {
    this.currentDragElement = dragElement
    this.emitUpdate()
  }

  public _setLastThankYou(lastThankYou: ILastThankYou) {
    // don't update if same length and same version (assumption
    // is that update will be either adding a user or updating version)
    const sameVersion =
      this.lastThankYou !== undefined &&
      this.lastThankYou.version === lastThankYou.version

    const sameNumCheckedUsers =
      this.lastThankYou !== undefined &&
      this.lastThankYou.checkedUsers.length === lastThankYou.checkedUsers.length

    if (sameVersion && sameNumCheckedUsers) {
      return
    }

    setObject(lastThankYouKey, lastThankYou)
    this.lastThankYou = lastThankYou

    this.emitUpdate()
  }

  public _setShowCIStatusPopover(showCIStatusPopover: boolean) {
    if (this.showCIStatusPopover !== showCIStatusPopover) {
      this.showCIStatusPopover = showCIStatusPopover
      this.emitUpdate()
    }
  }

  public _toggleCIStatusPopover() {
    this.showCIStatusPopover = !this.showCIStatusPopover
    this.emitUpdate()
  }

  // public _setPullRequestFileListWidth(width: number): Promise<void> {
  //   this.pullRequestFileListWidth = {
  //     ...this.pullRequestFileListWidth,
  //     value: width,
  //   }
  //   setNumber(pullRequestFileListConfigKey, width)
  //   this.updatePullRequestResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  // public _resetPullRequestFileListWidth(): Promise<void> {
  //   this.pullRequestFileListWidth = {
  //     ...this.pullRequestFileListWidth,
  //     value: defaultPullRequestFileListWidth,
  //   }
  //   localStorage.removeItem(pullRequestFileListConfigKey)
  //   this.updatePullRequestResizableConstraints()
  //   this.emitUpdate()

  //   return Promise.resolve()
  // }

  public _beginDeviceRegister(): Promise<void> {
    this.deviceRegisterStore.beginDeviceRegister();
    return Promise.resolve();
  }

  public async _registerDevice(
    hotel: string,
    deviceName: string,
    deviceDescription: string
  ): Promise<void> {
    const promise = await this.deviceRegisterStore.registerDevice(hotel, deviceName, deviceDescription);
    this.emitUpdate();
    return promise;
  }

  public async _verifyCode(code: string): Promise<void> {
    const promise = await this.deviceRegisterStore.verifyCode(code);
    this.emitUpdate();
    setTimeout(() => {
      this._endDeviceRegisterFlow();
    }, 1000);
    return promise;
  }

  public _endDeviceRegisterFlow(): Promise<void> {
    this.showDeviceRegisterFlow = false;
    this.emitUpdate();

    markDeviceRegisterFlowComplete();

    return Promise.resolve();
  }
}

function constrain(
  value: IConstrainedValue | number,
  min = -Infinity,
  max = Infinity
): IConstrainedValue {
  return { value: typeof value === 'number' ? value : value.value, min, max }
}
