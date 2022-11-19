import {
  AccountsStore,
  GitHubUserStore,
  DeviceRegisterStore,
} from '.'
import { Account } from '../../models/account'
import { AppMenu, IMenu } from '../../models/app-menu'
import { Branch, IAheadBehind } from '../../models/branch'
import { BranchesTab } from '../../models/branches-tab'
import { CloneRepositoryTab } from '../../models/clone-repository-tab'
import { CloningRepository } from '../../models/cloning-repository'
import { Commit, CommitOneLine } from '../../models/commit'
import {
  DiffSelection,
  DiffSelectionType,
  DiffType,
  ImageDiffType,
} from '../../models/diff'
import { PullRequest } from '../../models/pull-request'
import {
  ILocalRepositoryState,
  Repository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
} from '../../models/status'
import { TipState, IValidBranch } from '../../models/tip'
import { Popup, PopupType } from '../../models/popup'
import { themeChangeMonitor } from '../../ui/lib/theme-change-monitor'
// import { getAppPath } from '../../ui/lib/app-proxy'
import {
  ApplicationTheme,
  getPersistedThemeName,
  ICustomTheme,
  setPersistedTheme,
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
  getEndpointForRepository,
} from '../api'
import { shell } from '../app-shell'
import {
  HistoryTabMode,
  Foldout,
  FoldoutType,
  IAppState,
  ICompareFormUpdate,
  RepositorySectionTab,
  ChangesSelectionKind,
  ChangesWorkingDirectorySelection,
  IConstrainedValue,
  ICompareState,
} from '../app-state'
import {
  findEditorOrDefault,
  getAvailableEditors,
  launchExternalEditor,
} from '../editors'
import { assertNever, forceUnwrap } from '../fatal-error'

import { getAccountForRepository } from '../get-account-for-repository'
import {
  getCommitDiff,
  getWorkingDirectoryDiff,
  getBranchAheadBehind,
  getCommitRangeDiff,
} from '../git'
import {
  installGlobalLFSFilters,
  installLFSHooks,
} from '../git/lfs'
import { updateMenuState } from '../menu-update'
import { merge } from '../merge'
import { RetryAction } from '../../models/retry-actions'
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
import { RepositoryStateCache } from './repository-state-cache'
// import { readEmoji } from '../read-emoji'
import {
  setNumber,
  setBoolean,
  getBoolean,
  getNumber,
  getEnum,
  getObject,
  setObject,
  getFloatNumber,
} from '../local-storage'
import { ExternalEditorError, suggestedExternalEditor } from '../editors/shared'
import { ApiRepositoriesStore } from './api-repositories-store'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { enableMultiCommitDiffs } from '../feature-flag'
import { Banner, BannerType } from '../../models/banner'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../../models/uncommitted-changes-strategy'
import { StashedChangesLoadStates } from '../../models/stash-entry'
import { arrayEquals } from '../equality'
import {
  TutorialStep,
  orderedTutorialSteps,
  isValidTutorialStep,
} from '../../models/tutorial-step'
import { OnboardingTutorialAssessor } from './helpers/tutorial-assessor'
import { parseRemote } from '../../lib/remote-parsing'
import {
  ShowSideBySideDiffDefault,
  getShowSideBySideDiff,
  setShowSideBySideDiff,
} from '../../ui/lib/diff-mode'
import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'
import { getTipSha } from '../tip'
import {
  MultiCommitOperationDetail,
  MultiCommitOperationKind,
  MultiCommitOperationStep,
  MultiCommitOperationStepKind,
} from '../../models/multi-commit-operation'
import { UseWindowsOpenSSHKey } from '../ssh/ssh'
import { clamp } from '../clamp'
import { EndpointToken } from '../endpoint-token'
import {
  NotificationsStore,
  getNotificationsEnabled,
} from './notifications-store'
import * as ipcRenderer from '../ipc-renderer'

const LastSelectedRepositoryIDKey = 'last-selected-repository-id'

const defaultSidebarWidth: number = 250
const sidebarWidthConfigKey: string = 'sidebar-width'

const defaultCommitSummaryWidth: number = 250
const commitSummaryWidthConfigKey: string = 'commit-summary-width'

const defaultStashedFilesWidth: number = 250
const stashedFilesWidthConfigKey: string = 'stashed-files-width'

const defaultPullRequestFileListWidth: number = 250
const pullRequestFileListConfigKey: string = 'pull-request-files-width'

const askToMoveToApplicationsFolderDefault: boolean = true
const confirmRepoRemovalDefault: boolean = true
const confirmDiscardChangesDefault: boolean = true
const confirmDiscardChangesPermanentlyDefault: boolean = true
const confirmDiscardStashDefault: boolean = true
const askForConfirmationOnForcePushDefault = true
const confirmUndoCommitDefault: boolean = true
const askToMoveToApplicationsFolderKey: string = 'askToMoveToApplicationsFolder'
const confirmRepoRemovalKey: string = 'confirmRepoRemoval'
const confirmDiscardChangesKey: string = 'confirmDiscardChanges'
const confirmDiscardStashKey: string = 'confirmDiscardStash'
const confirmDiscardChangesPermanentlyKey: string =
  'confirmDiscardChangesPermanentlyKey'
const confirmForcePushKey: string = 'confirmForcePush'
const confirmUndoCommitKey: string = 'confirmUndoCommit'

const uncommittedChangesStrategyKey = 'uncommittedChangesStrategyKind'

const externalEditorKey: string = 'externalEditor'

const imageDiffTypeDefault = ImageDiffType.TwoUp
const imageDiffTypeKey = 'image-diff-type'

const hideWhitespaceInChangesDiffDefault = false
const hideWhitespaceInChangesDiffKey = 'hide-whitespace-in-changes-diff'
const hideWhitespaceInHistoryDiffDefault = false
const hideWhitespaceInHistoryDiffKey = 'hide-whitespace-in-diff'
const hideWhitespaceInPullRequestDiffDefault = false
const hideWhitespaceInPullRequestDiffKey =
  'hide-whitespace-in-pull-request-diff'

const commitSpellcheckEnabledDefault = true
const commitSpellcheckEnabledKey = 'commit-spellcheck-enabled'

const shellKey = 'shell'

const repositoryIndicatorsEnabledKey = 'enable-repository-indicators'

const lastThankYouKey = 'version-and-users-of-last-thank-you'
const customThemeKey = 'custom-theme-key'
export class AppStore extends TypedBaseStore<IAppState> {
  // private readonly gitStoreCache: GitStoreCache

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()
  private repositories: ReadonlyArray<Repository> = new Array<Repository>()
  private recentRepositories: ReadonlyArray<number> = new Array<number>()

  private selectedRepository: Repository | CloningRepository | null = null

  // private showWelcomeFlow = false
  private showDeviceRegisterFlow = false
  private focusCommitMessage = false
  private currentPopup: Popup | null = null
  private currentFoldout: Foldout | null = null
  private currentBanner: Banner | null = null
  private errors: ReadonlyArray<Error> = new Array<Error>()
  private emitQueued = false

  private readonly localRepositoryStateLookup = new Map<
    number,
    ILocalRepositoryState
  >()

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
  private commitSummaryWidth = constrain(defaultCommitSummaryWidth)
  private stashedFilesWidth = constrain(defaultStashedFilesWidth)
  private pullRequestFileListWidth = constrain(defaultPullRequestFileListWidth)

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
  private showSideBySideDiff: boolean = ShowSideBySideDiffDefault

  private uncommittedChangesStrategy = defaultUncommittedChangesStrategy

  private selectedExternalEditor: string | null = null

  private resolvedExternalEditor: string | null = null

  /** The user's preferred shell. */
  private selectedShell = DefaultShell

  /** The current repository filter text */
  private repositoryFilterText: string = ''

  /** The function to resolve the current Open in Desktop flow. */
  private resolveOpenInDesktop:
    | ((repository: Repository | null) => void)
    | null = null

  private selectedCloneRepositoryTab = CloneRepositoryTab.DotCom

  private selectedBranchesTab = BranchesTab.Branches
  private selectedTheme = ApplicationTheme.System
  private customTheme?: ICustomTheme
  private currentTheme: ApplicationTheme = ApplicationTheme.Light

  private useWindowsOpenSSH: boolean = false

  private hasUserViewedStash = false

  private repositoryIndicatorsEnabled: boolean

  /** Which step the user needs to complete next in the onboarding tutorial */
  private currentOnboardingTutorialStep = TutorialStep.NotApplicable
  private readonly tutorialAssessor: OnboardingTutorialAssessor

  private currentDragElement: DragElement | null = null
  private lastThankYou: ILastThankYou | undefined
  private showCIStatusPopover: boolean = false

  public constructor(
    private readonly gitHubUserStore: GitHubUserStore,
    // private readonly cloningRepositoriesStore: CloningRepositoriesStore,
    // private readonly issuesStore: IssuesStore,
    private readonly statsStore: StatsStore,
    private readonly deviceRegisterStore: DeviceRegisterStore,
    private readonly accountsStore: AccountsStore,
    // private readonly repositoriesStore: RepositoriesStore,
    // private readonly pullRequestCoordinator: PullRequestCoordinator,
    private readonly repositoryStateCache: RepositoryStateCache,
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
    this.tutorialAssessor = new OnboardingTutorialAssessor(
      this.getResolvedExternalEditor
    )

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

  /** Figure out what step of the tutorial the user needs to do next */
  private async updateCurrentTutorialStep(
    repository: Repository
  ): Promise<void> {
    const currentStep = await this.tutorialAssessor.getCurrentStep(
      repository.isTutorialRepository,
      this.repositoryStateCache.get(repository)
    )
    // only emit an update if its changed
    if (currentStep !== this.currentOnboardingTutorialStep) {
      this.currentOnboardingTutorialStep = currentStep
      log.info(`Current tutorial step is now ${currentStep}`)
      this.recordTutorialStepCompleted(currentStep)
      this.emitUpdate()
    }
  }

  private recordTutorialStepCompleted(step: TutorialStep): void {
    if (!isValidTutorialStep(step)) {
      return
    }

    this.statsStore.recordHighestTutorialStepCompleted(
      orderedTutorialSteps.indexOf(step)
    )

    switch (step) {
      case TutorialStep.PickEditor:
        // don't need to record anything for the first step
        break
      case TutorialStep.CreateBranch:
        this.statsStore.recordTutorialEditorInstalled()
        break
      case TutorialStep.EditFile:
        this.statsStore.recordTutorialBranchCreated()
        break
      case TutorialStep.MakeCommit:
        this.statsStore.recordTutorialFileEdited()
        break
      case TutorialStep.PushBranch:
        this.statsStore.recordTutorialCommitCreated()
        break
      case TutorialStep.OpenPullRequest:
        this.statsStore.recordTutorialBranchPushed()
        break
      case TutorialStep.AllDone:
        this.statsStore.recordTutorialPrCreated()
        this.statsStore.recordTutorialCompleted()
        break
      default:
        assertNever(step, 'Unaccounted for step type')
    }
  }

  public async _resumeTutorial(repository: Repository) {
    this.tutorialAssessor.resumeTutorial()
    await this.updateCurrentTutorialStep(repository)
  }

  public async _pauseTutorial(repository: Repository) {
    this.tutorialAssessor.pauseTutorial()
    await this.updateCurrentTutorialStep(repository)
  }

  /** Call via `Dispatcher` when the user opts to skip the pick editor step of the onboarding tutorial */
  public async _skipPickEditorTutorialStep(repository: Repository) {
    this.tutorialAssessor.skipPickEditor()
    await this.updateCurrentTutorialStep(repository)
  }

  /**
   * Call  via `Dispatcher` when the user has either created a pull request or opts to
   * skip the create pull request step of the onboarding tutorial
   */
  public async _markPullRequestTutorialStepAsComplete(repository: Repository) {
    this.tutorialAssessor.markPullRequestTutorialStepAsComplete()
    await this.updateCurrentTutorialStep(repository)
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
      localRepositoryStateLookup: this.localRepositoryStateLookup,
      windowState: this.windowState,
      windowZoomFactor: this.windowZoomFactor,
      appIsFocused: this.appIsFocused,
      deviceRegisterState: this.deviceRegisterStore.getState(),
      currentPopup: this.currentPopup,
      currentFoldout: this.currentFoldout,
      errors: this.errors,
      // showWelcomeFlow: this.showWelcomeFlow,
      showDeviceRegisterFlow: this.showDeviceRegisterFlow,
      focusCommitMessage: this.focusCommitMessage,
      emoji: this.emoji,
      sidebarWidth: this.sidebarWidth,
      commitSummaryWidth: this.commitSummaryWidth,
      stashedFilesWidth: this.stashedFilesWidth,
      pullRequestFilesListWidth: this.pullRequestFileListWidth,
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
      showSideBySideDiff: this.showSideBySideDiff,
      selectedShell: this.selectedShell,
      repositoryFilterText: this.repositoryFilterText,
      resolvedExternalEditor: this.resolvedExternalEditor,
      selectedCloneRepositoryTab: this.selectedCloneRepositoryTab,
      selectedBranchesTab: this.selectedBranchesTab,
      selectedTheme: this.selectedTheme,
      customTheme: this.customTheme,
      currentTheme: this.currentTheme,
      apiRepositories: this.apiRepositoriesStore.getState(),
      useWindowsOpenSSH: this.useWindowsOpenSSH,
      optOutOfUsageTracking: this.statsStore.getOptOut(),
      currentOnboardingTutorialStep: this.currentOnboardingTutorialStep,
      repositoryIndicatorsEnabled: this.repositoryIndicatorsEnabled,
      commitSpellcheckEnabled: this.commitSpellcheckEnabled,
      currentDragElement: this.currentDragElement,
      lastThankYou: this.lastThankYou,
      showCIStatusPopover: this.showCIStatusPopover,
      notificationsEnabled: getNotificationsEnabled(),
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _changeCommitSelection(
    repository: Repository,
    shas: ReadonlyArray<string>,
    isContiguous: boolean
  ): void {
    const { commitSelection, commitLookup, compareState } =
      this.repositoryStateCache.get(repository)

    if (
      commitSelection.shas.length === shas.length &&
      commitSelection.shas.every((sha, i) => sha === shas[i])
    ) {
      return
    }

    const shasInDiff = this.getShasInDiff(shas, isContiguous, commitLookup)

    if (shas.length > 1 && isContiguous) {
      this.recordMultiCommitDiff(shas, shasInDiff, compareState)
    }

    this.repositoryStateCache.updateCommitSelection(repository, () => ({
      shas,
      shasInDiff,
      isContiguous,
      file: null,
      changesetData: { files: [], linesAdded: 0, linesDeleted: 0 },
      diff: null,
    }))

    this.emitUpdate()
  }

  private recordMultiCommitDiff(
    shas: ReadonlyArray<string>,
    shasInDiff: ReadonlyArray<string>,
    compareState: ICompareState
  ) {
    const isHistoryTab = compareState.formState.kind === HistoryTabMode.History

    if (isHistoryTab) {
      this.statsStore.recordMultiCommitDiffFromHistoryCount()
    } else {
      this.statsStore.recordMultiCommitDiffFromCompareCount()
    }

    const hasUnreachableCommitWarning = !shas.every(s => shasInDiff.includes(s))

    if (hasUnreachableCommitWarning) {
      this.statsStore.recordMultiCommitDiffWithUnreachableCommitWarningCount()
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _updateShasToHighlight(
    repository: Repository,
    shasToHighlight: ReadonlyArray<string>
  ) {
    this.repositoryStateCache.updateCompareState(repository, () => ({
      shasToHighlight,
    }))
    this.emitUpdate()
  }

  /**
   * When multiple commits are selected, the diff is created using the rev range
   * of firstSha^..lastSha in the selected shas. Thus comparing the trees of the
   * the lastSha and the first parent of the first sha. However, our history
   * list shows commits in chronological order. Thus, when a branch is merged,
   * the commits from that branch are injected in their chronological order into
   * the history list. Therefore, given a branch history of A, B, C, D,
   * MergeCommit where B and C are from the merged branch, diffing on the
   * selection of A through D would not have the changes from B an C.
   *
   * This method traverses the ancestral path from the last commit in the
   * selection back to the first commit via checking the parents. The
   * commits on this path are the commits whose changes will be seen in the
   * diff. This is equivalent to doing `git rev-list firstSha^..lastSha`.
   */
  private getShasInDiff(
    selectedShas: ReadonlyArray<string>,
    isContiguous: boolean,
    commitLookup: Map<string, Commit>
  ) {
    const shasInDiff = new Array<string>()

    if (selectedShas.length <= 1 || !isContiguous) {
      return selectedShas
    }

    const shasToTraverse = [selectedShas.at(-1)]
    do {
      const currentSha = shasToTraverse.pop()
      if (currentSha === undefined) {
        continue
      }

      shasInDiff.push(currentSha)

      // shas are selection of history -> should be in lookup ->  `|| []` is for typing sake
      const parentSHAs = commitLookup.get(currentSha)?.parentSHAs || []

      const parentsInSelection = parentSHAs.filter(parentSha =>
        selectedShas.includes(parentSha)
      )

      shasToTraverse.push(...parentsInSelection)
    } while (shasToTraverse.length > 0)

    return shasInDiff
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _updateCompareForm<K extends keyof ICompareFormUpdate>(
    repository: Repository,
    newState: Pick<ICompareFormUpdate, K>
  ) {
    this.repositoryStateCache.updateCompareState(repository, state => {
      return merge(state, newState)
    })

    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setRepositoryFilterText(text: string): Promise<void> {
    this.repositoryFilterText = text
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _changeFileSelection(
    repository: Repository,
    file: CommittedFileChange
  ): Promise<void> {
    this.repositoryStateCache.updateCommitSelection(repository, () => ({
      file,
      diff: null,
    }))
    this.emitUpdate()

    const stateBeforeLoad = this.repositoryStateCache.get(repository)
    const { shas, isContiguous } = stateBeforeLoad.commitSelection

    if (shas.length === 0) {
      if (__DEV__) {
        throw new Error(
          "No currently selected sha yet we've been asked to switch file selection"
        )
      } else {
        return
      }
    }

    if (shas.length > 1 && (!enableMultiCommitDiffs() || !isContiguous)) {
      return
    }

    const diff =
      shas.length > 1
        ? await getCommitRangeDiff(
          repository,
          file,
          shas,
          this.hideWhitespaceInHistoryDiff
        )
        : await getCommitDiff(
          repository,
          file,
          shas[0],
          this.hideWhitespaceInHistoryDiff
        )

    const stateAfterLoad = this.repositoryStateCache.get(repository)
    const { shas: shasAfter } = stateAfterLoad.commitSelection
    // A whole bunch of things could have happened since we initiated the diff load
    if (
      shasAfter.length !== shas.length ||
      !shas.every((sha, i) => sha === shasAfter[i])
    ) {
      return
    }

    if (!stateAfterLoad.commitSelection.file) {
      return
    }
    if (stateAfterLoad.commitSelection.file.id !== file.id) {
      return
    }

    this.repositoryStateCache.updateCommitSelection(repository, () => ({
      diff,
    }))

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

    this.updateRepositorySelectionAfterRepositoriesChanged()

    this.sidebarWidth = constrain(
      getNumber(sidebarWidthConfigKey, defaultSidebarWidth)
    )
    this.commitSummaryWidth = constrain(
      getNumber(commitSummaryWidthConfigKey, defaultCommitSummaryWidth)
    )
    this.stashedFilesWidth = constrain(
      getNumber(stashedFilesWidthConfigKey, defaultStashedFilesWidth)
    )
    this.pullRequestFileListWidth = constrain(
      getNumber(pullRequestFileListConfigKey, defaultPullRequestFileListWidth)
    )

    this.updateResizableConstraints()
    // TODO: Initiliaze here for now... maybe move to dialog mounting
    this.updatePullRequestResizableConstraints()

    this.askToMoveToApplicationsFolderSetting = getBoolean(
      askToMoveToApplicationsFolderKey,
      askToMoveToApplicationsFolderDefault
    )

    this.askForConfirmationOnRepositoryRemoval = getBoolean(
      confirmRepoRemovalKey,
      confirmRepoRemovalDefault
    )

    this.confirmDiscardChanges = getBoolean(
      confirmDiscardChangesKey,
      confirmDiscardChangesDefault
    )

    this.confirmDiscardChangesPermanently = getBoolean(
      confirmDiscardChangesPermanentlyKey,
      confirmDiscardChangesPermanentlyDefault
    )

    this.confirmDiscardStash = getBoolean(
      confirmDiscardStashKey,
      confirmDiscardStashDefault
    )

    this.askForConfirmationOnForcePush = getBoolean(
      confirmForcePushKey,
      askForConfirmationOnForcePushDefault
    )

    this.confirmUndoCommit = getBoolean(
      confirmUndoCommitKey,
      confirmUndoCommitDefault
    )

    this.uncommittedChangesStrategy =
      getEnum(uncommittedChangesStrategyKey, UncommittedChangesStrategy) ??
      defaultUncommittedChangesStrategy

    this.updateSelectedExternalEditor(
      await this.lookupSelectedExternalEditor()
    ).catch(e => log.error('Failed resolving current editor at startup', e))

    const shellValue = localStorage.getItem(shellKey)
    this.selectedShell = shellValue ? parseShell(shellValue) : DefaultShell

    const imageDiffTypeValue = localStorage.getItem(imageDiffTypeKey)
    this.imageDiffType =
      imageDiffTypeValue === null
        ? imageDiffTypeDefault
        : parseInt(imageDiffTypeValue)

    this.hideWhitespaceInChangesDiff = getBoolean(
      hideWhitespaceInChangesDiffKey,
      false
    )
    this.hideWhitespaceInHistoryDiff = getBoolean(
      hideWhitespaceInHistoryDiffKey,
      false
    )
    this.hideWhitespaceInPullRequestDiff = getBoolean(
      hideWhitespaceInPullRequestDiffKey,
      false
    )
    this.commitSpellcheckEnabled = getBoolean(
      commitSpellcheckEnabledKey,
      commitSpellcheckEnabledDefault
    )
    this.showSideBySideDiff = getShowSideBySideDiff()

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
    const diffPaneMinWidth = 150
    const filesMax = available - diffPaneMinWidth

    this.commitSummaryWidth = constrain(this.commitSummaryWidth, 100, filesMax)
    this.stashedFilesWidth = constrain(this.stashedFilesWidth, 100, filesMax)
  }

  /**
   * Calculate the constraints of the resizable pane in the pull request dialog
   * whenever the window dimensions change.
   */
  private updatePullRequestResizableConstraints() {
    // TODO: Get width of PR dialog -> determine if we will have default width
    // for pr dialog. The goal is for it expand to fill some percent of
    // available window so it will change on window resize. We may have some max
    // value and min value of where to derive a default is we cannot obtain the
    // width for some reason (like initialization nad no pr dialog is open)
    // Thoughts -> ß
    // 1. Use dialog id to grab dialog if exists, else use default
    // 2. Pass dialog width up when and call this contrainst on dialog mounting
    //    to initialize and subscribe to window resize inside dialog to be able
    //    to pass up dialog width on window resize.

    // Get the width of the dialog
    const available = 850
    const dialogPadding = 20

    // This is a pretty silly width for a diff but it will fit ~9 chars per line
    // in unified mode after subtracting the width of the unified gutter and ~4
    // chars per side in split diff mode. No one would want to use it this way
    // but it doesn't break the layout and it allows users to temporarily
    // maximize the width of the file list to see long path names.
    const diffPaneMinWidth = 150
    const filesListMax = available - dialogPadding - diffPaneMinWidth

    this.pullRequestFileListWidth = constrain(
      this.pullRequestFileListWidth,
      100,
      filesListMax
    )
  }

  private updateSelectedExternalEditor(
    selectedEditor: string | null
  ): Promise<void> {
    this.selectedExternalEditor = selectedEditor

    // Make sure we keep the resolved (cached) editor
    // in sync when the user changes their editor choice.
    return this._resolveCurrentEditor()
  }

  private async lookupSelectedExternalEditor(): Promise<string | null> {
    const editors = (await getAvailableEditors()).map(found => found.editor)

    const value = localStorage.getItem(externalEditorKey)
    // ensure editor is still installed
    if (value && editors.includes(value)) {
      return value
    }

    if (editors.length) {
      const value = editors[0]
      // store this value to avoid the lookup next time
      localStorage.setItem(externalEditorKey, value)
      return value
    }

    return null
  }

  private updateRepositorySelectionAfterRepositoriesChanged() {
    const selectedRepository = this.selectedRepository
    let newSelectedRepository: Repository | CloningRepository | null =
      this.selectedRepository
    if (selectedRepository) {
      const r =
        this.repositories.find(
          r =>
            r.constructor === selectedRepository.constructor &&
            r.id === selectedRepository.id
        ) || null

      newSelectedRepository = r
    }

    if (newSelectedRepository === null && this.repositories.length > 0) {
      const lastSelectedID = getNumber(LastSelectedRepositoryIDKey, 0)
      if (lastSelectedID > 0) {
        newSelectedRepository =
          this.repositories.find(r => r.id === lastSelectedID) || null
      }

      if (!newSelectedRepository) {
        newSelectedRepository = this.repositories[0]
      }
    }

  }

  /**
   * Loads or re-loads (refreshes) the diff for the currently selected file
   * in the working directory. This operation is a noop if there's no currently
   * selected file.
   */
  private async updateChangesWorkingDirectoryDiff(
    repository: Repository
  ): Promise<void> {
    const stateBeforeLoad = this.repositoryStateCache.get(repository)
    const changesStateBeforeLoad = stateBeforeLoad.changesState

    if (
      changesStateBeforeLoad.selection.kind !==
      ChangesSelectionKind.WorkingDirectory
    ) {
      return
    }

    const selectionBeforeLoad = changesStateBeforeLoad.selection
    const selectedFileIDsBeforeLoad = selectionBeforeLoad.selectedFileIDs

    // We only render diffs when a single file is selected.
    if (selectedFileIDsBeforeLoad.length !== 1) {
      if (selectionBeforeLoad.diff !== null) {
        this.repositoryStateCache.updateChangesState(repository, () => ({
          selection: {
            ...selectionBeforeLoad,
            diff: null,
          },
        }))
        this.emitUpdate()
      }
      return
    }

    const selectedFileIdBeforeLoad = selectedFileIDsBeforeLoad[0]
    const selectedFileBeforeLoad =
      changesStateBeforeLoad.workingDirectory.findFileWithID(
        selectedFileIdBeforeLoad
      )

    if (selectedFileBeforeLoad === null) {
      return
    }

    const diff = await getWorkingDirectoryDiff(
      repository,
      selectedFileBeforeLoad,
      this.hideWhitespaceInChangesDiff
    )

    const stateAfterLoad = this.repositoryStateCache.get(repository)
    const changesState = stateAfterLoad.changesState

    // A different file (or files) could have been selected while we were
    // loading the diff in which case we no longer care about the diff we
    // just loaded.
    if (
      changesState.selection.kind !== ChangesSelectionKind.WorkingDirectory ||
      !arrayEquals(
        changesState.selection.selectedFileIDs,
        selectedFileIDsBeforeLoad
      )
    ) {
      return
    }

    const selectedFileID = changesState.selection.selectedFileIDs[0]

    if (selectedFileID !== selectedFileIdBeforeLoad) {
      return
    }

    const currentlySelectedFile =
      changesState.workingDirectory.findFileWithID(selectedFileID)
    if (currentlySelectedFile === null) {
      return
    }

    const selectableLines = new Set<number>()
    if (diff.kind === DiffType.Text || diff.kind === DiffType.LargeText) {
      // The diff might have changed dramatically since last we loaded it.
      // Ideally we would be more clever about validating that any partial
      // selection state is still valid by ensuring that selected lines still
      // exist but for now we'll settle on just updating the selectable lines
      // such that any previously selected line which now no longer exists or
      // has been turned into a context line isn't still selected.
      diff.hunks.forEach(h => {
        h.lines.forEach((line, index) => {
          if (line.isIncludeableLine()) {
            selectableLines.add(h.unifiedDiffStart + index)
          }
        })
      })
    }

    const newSelection =
      currentlySelectedFile.selection.withSelectableLines(selectableLines)
    const selectedFile = currentlySelectedFile.withSelection(newSelection)
    const updatedFiles = changesState.workingDirectory.files.map(f =>
      f.id === selectedFile.id ? selectedFile : f
    )
    const workingDirectory = WorkingDirectoryStatus.fromFiles(updatedFiles)

    const selection: ChangesWorkingDirectorySelection = {
      ...changesState.selection,
      diff,
    }

    this.repositoryStateCache.updateChangesState(repository, () => ({
      selection,
      workingDirectory,
    }))
    this.emitUpdate()
  }

  public _hideStashedChanges(repository: Repository) {
    const { changesState } = this.repositoryStateCache.get(repository)

    // makes this safe to call even when the stash ui is not visible
    if (changesState.selection.kind !== ChangesSelectionKind.Stash) {
      return
    }

    this.repositoryStateCache.updateChangesState(repository, state => {
      const files = state.workingDirectory.files
      const selectedFileIds = files
        .filter(f => f.selection.getSelectionType() !== DiffSelectionType.None)
        .map(f => f.id)

      return {
        selection: {
          kind: ChangesSelectionKind.WorkingDirectory,
          diff: null,
          selectedFileIDs: selectedFileIds,
        },
      }
    })
    this.emitUpdate()

  }

  /**
   * Changes the selection in the changes view to the stash entry view and
   * optionally selects a particular file from the current stash entry.
   *
   *  @param file  A file to select when showing the stash entry.
   *               If undefined this method will preserve the previously selected
   *               file or pick the first changed file if no selection exists.
   *
   * Note: This shouldn't be called directly. See `Dispatcher`.
   */
  public async _selectStashedFile(
    repository: Repository,
    file?: CommittedFileChange | null
  ): Promise<void> {
    this.repositoryStateCache.update(repository, () => ({
      selectedSection: RepositorySectionTab.Changes,
    }))
    this.repositoryStateCache.updateChangesState(repository, state => {
      let selectedStashedFile: CommittedFileChange | null = null
      const { stashEntry, selection } = state

      const currentlySelectedFile =
        selection.kind === ChangesSelectionKind.Stash
          ? selection.selectedStashedFile
          : null

      const currentFiles =
        stashEntry !== null &&
          stashEntry.files.kind === StashedChangesLoadStates.Loaded
          ? stashEntry.files.files
          : []

      if (file === undefined) {
        if (currentlySelectedFile !== null) {
          // Ensure the requested file exists in the stash entry and
          // that we can use reference equality to figure out which file
          // is selected in the list. If we can't find it we'll pick the
          // first file available or null if no files have been loaded.
          selectedStashedFile =
            currentFiles.find(x => x.id === currentlySelectedFile.id) ||
            currentFiles[0] ||
            null
        } else {
          // No current selection, let's just pick the first file available
          // or null if no files have been loaded.
          selectedStashedFile = currentFiles[0] || null
        }
      } else if (file !== null) {
        // Look up the selected file in the stash entry, it's possible that
        // the stash entry or file list has changed since the consumer called
        // us. The working directory selection handles this by using IDs rather
        // than references.
        selectedStashedFile = currentFiles.find(x => x.id === file.id) || null
      }

      return {
        selection: {
          kind: ChangesSelectionKind.Stash,
          selectedStashedFile,
          selectedStashedFileDiff: null,
        },
      }
    })

    this.emitUpdate()
    this.updateChangesStashDiff(repository)

    if (!this.hasUserViewedStash) {
      // `hasUserViewedStash` is reset to false on every branch checkout
      // so we increment the metric before setting `hasUserViewedStash` to true
      // to make sure we only increment on the first view after checkout
      this.statsStore.recordStashViewedAfterCheckout()
      this.hasUserViewedStash = true
    }
  }

  private async updateChangesStashDiff(repository: Repository) {
    const stateBeforeLoad = this.repositoryStateCache.get(repository)
    const changesStateBeforeLoad = stateBeforeLoad.changesState
    const selectionBeforeLoad = changesStateBeforeLoad.selection

    if (selectionBeforeLoad.kind !== ChangesSelectionKind.Stash) {
      return
    }

    const stashEntry = changesStateBeforeLoad.stashEntry

    if (stashEntry === null) {
      return
    }

    let file = selectionBeforeLoad.selectedStashedFile

    if (file === null) {
      if (stashEntry.files.kind === StashedChangesLoadStates.Loaded) {
        if (stashEntry.files.files.length > 0) {
          file = stashEntry.files.files[0]
        }
      }
    }

    if (file === null) {
      this.repositoryStateCache.updateChangesState(repository, () => ({
        selection: {
          kind: ChangesSelectionKind.Stash,
          selectedStashedFile: null,
          selectedStashedFileDiff: null,
        },
      }))
      this.emitUpdate()
      return
    }

    const diff = await getCommitDiff(repository, file, file.commitish)

    const stateAfterLoad = this.repositoryStateCache.get(repository)
    const changesStateAfterLoad = stateAfterLoad.changesState

    // Something has changed during our async getCommitDiff, bail
    if (
      changesStateAfterLoad.selection.kind !== ChangesSelectionKind.Stash ||
      changesStateAfterLoad.selection.selectedStashedFile !==
      selectionBeforeLoad.selectedStashedFile
    ) {
      return
    }

    this.repositoryStateCache.updateChangesState(repository, () => ({
      selection: {
        kind: ChangesSelectionKind.Stash,
        selectedStashedFile: file,
        selectedStashedFileDiff: diff,
      },
    }))
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _changeFileIncluded(
    repository: Repository,
    file: WorkingDirectoryFileChange,
    include: boolean
  ): Promise<void> {
    const selection = include
      ? file.selection.withSelectAll()
      : file.selection.withSelectNone()
    this.updateWorkingDirectoryFileSelection(repository, file, selection)
    return Promise.resolve()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _changeFileLineSelection(
    repository: Repository,
    file: WorkingDirectoryFileChange,
    diffSelection: DiffSelection
  ): Promise<void> {
    this.updateWorkingDirectoryFileSelection(repository, file, diffSelection)
    return Promise.resolve()
  }

  /**
   * Updates the selection for the given file in the working directory state and
   * emits an update event.
   */
  private updateWorkingDirectoryFileSelection(
    repository: Repository,
    file: WorkingDirectoryFileChange,
    selection: DiffSelection
  ) {
    this.repositoryStateCache.updateChangesState(repository, state => {
      const newFiles = state.workingDirectory.files.map(f =>
        f.id === file.id ? f.withSelection(selection) : f
      )

      const workingDirectory = WorkingDirectoryStatus.fromFiles(newFiles)

      return { workingDirectory }
    })

    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _changeIncludeAllFiles(
    repository: Repository,
    includeAll: boolean
  ): Promise<void> {
    this.repositoryStateCache.updateChangesState(repository, state => {
      const workingDirectory =
        state.workingDirectory.withIncludeAllFiles(includeAll)
      return { workingDirectory }
    })

    this.emitUpdate()

    return Promise.resolve()
  }

  public _setCommitSpellcheckEnabled(commitSpellcheckEnabled: boolean) {
    if (this.commitSpellcheckEnabled === commitSpellcheckEnabled) {
      return
    }

    setBoolean(commitSpellcheckEnabledKey, commitSpellcheckEnabled)
    this.commitSpellcheckEnabled = commitSpellcheckEnabled

    this.emitUpdate()
  }

  public _setUseWindowsOpenSSH(useWindowsOpenSSH: boolean) {
    setBoolean(UseWindowsOpenSSHKey, useWindowsOpenSSH)
    this.useWindowsOpenSSH = useWindowsOpenSSH

    this.emitUpdate()
  }

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

    if (currentPopup.type === PopupType.CloneRepository) {
      this._completeOpenInDesktop(() => Promise.resolve(null))
    }

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

  public _setRepositoryCommitToAmend(
    repository: Repository,
    commit: Commit | null
  ) {
    this.repositoryStateCache.update(repository, () => {
      return {
        commitToAmend: commit,
      }
    })

    this.emitUpdate()
  }

  // public _endWelcomeFlow(): Promise<void> {
  //   this.showWelcomeFlow = false
  //   this.emitUpdate()

  //   markWelcomeFlowComplete()

  //   this.statsStore.recordWelcomeWizardTerminated()

  //   return Promise.resolve()
  // }

  public _setCommitMessageFocus(focus: boolean) {
    if (this.focusCommitMessage !== focus) {
      this.focusCommitMessage = focus
      this.emitUpdate()
    }
  }

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

  public _setCommitSummaryWidth(width: number): Promise<void> {
    this.commitSummaryWidth = { ...this.commitSummaryWidth, value: width }
    setNumber(commitSummaryWidthConfigKey, width)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public _resetCommitSummaryWidth(): Promise<void> {
    this.commitSummaryWidth = {
      ...this.commitSummaryWidth,
      value: defaultCommitSummaryWidth,
    }
    localStorage.removeItem(commitSummaryWidthConfigKey)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

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
  public _setConflictsResolved(repository: Repository) {
    const { multiCommitOperationState } =
      this.repositoryStateCache.get(repository)

    // the operation has already completed.
    if (multiCommitOperationState === null) {
      return
    }

    // an update is not emitted here because there is no need
    // to trigger a re-render at this point

    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        userHasResolvedConflicts: true,
      })
    )
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

  public _setConfirmRepositoryRemovalSetting(
    confirmRepoRemoval: boolean
  ): Promise<void> {
    this.askForConfirmationOnRepositoryRemoval = confirmRepoRemoval
    setBoolean(confirmRepoRemovalKey, confirmRepoRemoval)

    this.emitUpdate()

    return Promise.resolve()
  }

  public _setConfirmDiscardChangesSetting(value: boolean): Promise<void> {
    this.confirmDiscardChanges = value

    setBoolean(confirmDiscardChangesKey, value)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setConfirmDiscardChangesPermanentlySetting(
    value: boolean
  ): Promise<void> {
    this.confirmDiscardChangesPermanently = value

    setBoolean(confirmDiscardChangesPermanentlyKey, value)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setConfirmDiscardStashSetting(value: boolean): Promise<void> {
    this.confirmDiscardStash = value

    setBoolean(confirmDiscardStashKey, value)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setConfirmForcePushSetting(value: boolean): Promise<void> {
    this.askForConfirmationOnForcePush = value
    setBoolean(confirmForcePushKey, value)

    this.emitUpdate()

    return Promise.resolve()
  }

  public _setConfirmUndoCommitSetting(value: boolean): Promise<void> {
    this.confirmUndoCommit = value
    setBoolean(confirmUndoCommitKey, value)

    this.emitUpdate()

    return Promise.resolve()
  }

  public _setUncommittedChangesStrategySetting(
    value: UncommittedChangesStrategy
  ): Promise<void> {
    this.uncommittedChangesStrategy = value

    localStorage.setItem(uncommittedChangesStrategyKey, value)

    this.emitUpdate()
    return Promise.resolve()
  }

  public _setExternalEditor(selectedEditor: string) {
    const promise = this.updateSelectedExternalEditor(selectedEditor)
    localStorage.setItem(externalEditorKey, selectedEditor)
    this.emitUpdate()

    return promise
  }

  public _setShell(shell: Shell): Promise<void> {
    this.selectedShell = shell
    localStorage.setItem(shellKey, shell)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _changeImageDiffType(type: ImageDiffType): Promise<void> {
    this.imageDiffType = type
    localStorage.setItem(imageDiffTypeKey, JSON.stringify(this.imageDiffType))
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setHideWhitespaceInHistoryDiff(
    hideWhitespaceInDiff: boolean,
    repository: Repository,
    file: CommittedFileChange | null
  ): Promise<void> {
    setBoolean(hideWhitespaceInHistoryDiffKey, hideWhitespaceInDiff)
    this.hideWhitespaceInHistoryDiff = hideWhitespaceInDiff

    if (file === null) {
      return this.updateChangesWorkingDirectoryDiff(repository)
    } else {
      return this._changeFileSelection(repository, file)
    }
  }

  public _setShowSideBySideDiff(showSideBySideDiff: boolean) {
    if (showSideBySideDiff !== this.showSideBySideDiff) {
      setShowSideBySideDiff(showSideBySideDiff)
      this.showSideBySideDiff = showSideBySideDiff
      this.statsStore.recordDiffModeChanged()
      this.emitUpdate()
    }
  }

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

  public _reportStats() {
    return this.statsStore.reportStats(this.accounts, this.repositories)
  }

  public _recordLaunchStats(stats: ILaunchStats): Promise<void> {
    return this.statsStore.recordLaunchStats(stats)
  }

  public async _setAppFocusState(isFocused: boolean): Promise<void> {
    if (this.appIsFocused !== isFocused) {
      this.appIsFocused = isFocused
      this.emitUpdate()
    }
  }

  /**
   * Start an Open in Desktop flow. This will return a new promise which will
   * resolve when `_completeOpenInDesktop` is called.
   */
  public _startOpenInDesktop(fn: () => void): Promise<Repository | null> {
    const p = new Promise<Repository | null>(
      resolve => (this.resolveOpenInDesktop = resolve)
    )
    fn()
    return p
  }

  /**
   * Complete any active Open in Desktop flow with the repository returned by
   * the given function.
   */
  public async _completeOpenInDesktop(
    fn: () => Promise<Repository | null>
  ): Promise<Repository | null> {
    const resolve = this.resolveOpenInDesktop
    this.resolveOpenInDesktop = null

    const result = await fn()
    if (resolve) {
      resolve(result)
    }

    return result
  }

  public _removeAccount(account: Account): Promise<void> {
    log.info(
      `[AppStore] removing account ${account.login} (${account.name}) from store`
    )
    return this.accountsStore.removeAccount(account)
  }

  public async _installGlobalLFSFilters(force: boolean): Promise<void> {
    try {
      await installGlobalLFSFilters(force)
    } catch (error) {
      this.emitError(error)
    }
  }

  public async _installLFSHooks(
    repositories: ReadonlyArray<Repository>
  ): Promise<void> {
    for (const repo of repositories) {
      try {
        // At this point we've asked the user if we should install them, so
        // force installation.
        await installLFSHooks(repo, true)
      } catch (error) {
        this.emitError(error)
      }
    }
  }

  public _changeCloneRepositoriesTab(tab: CloneRepositoryTab): Promise<void> {
    this.selectedCloneRepositoryTab = tab

    this.emitUpdate()

    return Promise.resolve()
  }

  /**
   * Request a refresh of the list of repositories that
   * the provided account has explicit permissions to access.
   * See ApiRepositoriesStore for more details.
   */
  public _refreshApiRepositories(account: Account) {
    return this.apiRepositoriesStore.loadRepositories(account)
  }

  public _changeBranchesTab(tab: BranchesTab): Promise<void> {
    this.selectedBranchesTab = tab

    this.emitUpdate()

    return Promise.resolve()
  }

  public async _showGitHubExplore(repository: Repository): Promise<void> {
    const { gitHubRepository } = repository
    if (!gitHubRepository || gitHubRepository.htmlURL === null) {
      return
    }

    const url = new URL(gitHubRepository.htmlURL)
    url.pathname = '/explore'

    await this._openInBrowser(url.toString())
  }

  public async _createPullRequest(repository: Repository): Promise<void> {
    const gitHubRepository = repository.gitHubRepository
    if (!gitHubRepository) {
      return
    }

    const state = this.repositoryStateCache.get(repository)
    const tip = state.branchesState.tip

    if (tip.kind !== TipState.Valid) {
      return
    }

    const branch = tip.branch
    const aheadBehind = state.aheadBehind

    if (aheadBehind == null) {
      this._showPopup({
        type: PopupType.PushBranchCommits,
        repository,
        branch,
      })
    } else if (aheadBehind.ahead > 0) {
      this._showPopup({
        type: PopupType.PushBranchCommits,
        repository,
        branch,
        unPushedCommits: aheadBehind.ahead,
      })
    } else {
      await this._openCreatePullRequestInBrowser(repository, branch)
    }
  }

  public async _showPullRequest(repository: Repository): Promise<void> {
    // no pull requests from non github repos
    if (repository.gitHubRepository === null) {
      return
    }

    const currentPullRequest =
      this.repositoryStateCache.get(repository).branchesState.currentPullRequest

    if (currentPullRequest === null) {
      return
    }

    return this._showPullRequestByPR(currentPullRequest)
  }

  public async _showPullRequestByPR(pr: PullRequest): Promise<void> {
    const { htmlURL: baseRepoUrl } = pr.base.gitHubRepository

    if (baseRepoUrl === null) {
      return
    }

    const showPrUrl = `${baseRepoUrl}/pull/${pr.pullRequestNumber}`

    await this._openInBrowser(showPrUrl)
  }

  public async _openCreatePullRequestInBrowser(
    repository: Repository,
    branch: Branch
  ): Promise<void> {
    const gitHubRepository = repository.gitHubRepository
    if (!gitHubRepository) {
      return
    }

    const urlEncodedBranchName = encodeURIComponent(branch.nameWithoutRemote)
    const baseURL = `${gitHubRepository.htmlURL}/pull/new/${urlEncodedBranchName}`

    await this._openInBrowser(baseURL)

    if (this.currentOnboardingTutorialStep === TutorialStep.OpenPullRequest) {
      this._markPullRequestTutorialStepAsComplete(repository)
    }
  }

  private getIgnoreExistingUpstreamRemoteKey(repository: Repository): string {
    return `repository/${repository.id}/ignoreExistingUpstreamRemote`
  }

  public _ignoreExistingUpstreamRemote(repository: Repository): Promise<void> {
    const key = this.getIgnoreExistingUpstreamRemoteKey(repository)
    setBoolean(key, true)

    return Promise.resolve()
  }

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

  public async _resolveCurrentEditor() {
    const match = await findEditorOrDefault(this.selectedExternalEditor)
    const resolvedExternalEditor = match != null ? match.editor : null
    if (this.resolvedExternalEditor !== resolvedExternalEditor) {
      this.resolvedExternalEditor = resolvedExternalEditor

      // Make sure we let the tutorial assessor know that we have a new editor
      // in case it's stuck waiting for one to be selected.
      if (this.currentOnboardingTutorialStep === TutorialStep.PickEditor) {
        if (this.selectedRepository instanceof Repository) {
          this.updateCurrentTutorialStep(this.selectedRepository)
        }
      }

      this.emitUpdate()
    }
  }

  public getResolvedExternalEditor = () => {
    return this.resolvedExternalEditor
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _updateManualConflictResolution(
    repository: Repository,
    path: string,
    manualResolution: ManualConflictResolution | null
  ) {
    this.repositoryStateCache.updateChangesState(repository, state => {
      const { conflictState } = state

      if (conflictState === null) {
        // not currently in a conflict, whatever
        return { conflictState }
      }

      const updatedManualResolutions = new Map(conflictState.manualResolutions)

      if (manualResolution !== null) {
        updatedManualResolutions.set(path, manualResolution)
      } else {
        updatedManualResolutions.delete(path)
      }

      return {
        conflictState: {
          ...conflictState,
          manualResolutions: updatedManualResolutions,
        },
      }
    })

    this.updateMultiCommitOperationStateAfterManualResolution(repository)

    this.emitUpdate()
  }

  /**
   * Updates the multi commit operation conflict step state as the manual
   * resolutions have been changed.
   */
  private updateMultiCommitOperationStateAfterManualResolution(
    repository: Repository
  ): void {
    const currentState = this.repositoryStateCache.get(repository)

    const { changesState, multiCommitOperationState } = currentState

    if (
      changesState.conflictState === null ||
      multiCommitOperationState === null ||
      multiCommitOperationState.step.kind !==
      MultiCommitOperationStepKind.ShowConflicts
    ) {
      return
    }
    const { step } = multiCommitOperationState

    const { manualResolutions } = changesState.conflictState
    const conflictState = { ...step.conflictState, manualResolutions }
    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        step: { ...step, conflictState },
      })
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _setStashedFilesWidth(width: number): Promise<void> {
    this.stashedFilesWidth = { ...this.stashedFilesWidth, value: width }
    setNumber(stashedFilesWidthConfigKey, width)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public _resetStashedFilesWidth(): Promise<void> {
    this.stashedFilesWidth = {
      ...this.stashedFilesWidth,
      value: defaultStashedFilesWidth,
    }
    localStorage.removeItem(stashedFilesWidthConfigKey)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public async _showCreateForkDialog(
    repository: RepositoryWithGitHubRepository
  ) {
    const account = getAccountForRepository(this.accounts, repository)
    if (account === null) {
      return
    }
    await this._showPopup({
      type: PopupType.CreateFork,
      repository,
      account,
    })
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _initializeCherryPickProgress(
    repository: Repository,
    commits: ReadonlyArray<CommitOneLine>
  ) {
    // This shouldn't happen... but in case throw error.
    const lastCommit = forceUnwrap(
      'Unable to initialize cherry-pick progress. No commits provided.',
      commits.at(-1)
    )

    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        progress: {
          kind: 'multiCommitOperation',
          value: 0,
          position: 1,
          totalCommitCount: commits.length,
          currentCommitSummary: lastCommit.summary,
        },
      })
    )

    this.emitUpdate()
  }

  /**
   * Checks for uncommitted changes
   *
   * If uncommitted changes exist, ask user to stash, retry provided retry
   * action and return true.
   *
   * If no uncommitted changes, return false.
   *
   * This shouldn't be called directly. See `Dispatcher`.
   */
  public _checkForUncommittedChanges(
    repository: Repository,
    retryAction: RetryAction
  ): boolean {
    const { changesState } = this.repositoryStateCache.get(repository)
    const hasChanges = changesState.workingDirectory.files.length > 0
    if (!hasChanges) {
      return false
    }

    this._showPopup({
      type: PopupType.LocalChangesOverwritten,
      repository,
      retryAction,
      files: changesState.workingDirectory.files.map(f => f.path),
    })

    return true
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _setCherryPickBranchCreated(
    repository: Repository,
    branchCreated: boolean
  ): void {
    const { multiCommitOperationState: opState } =
      this.repositoryStateCache.get(repository)

    if (
      opState === null ||
      opState.operationDetail.kind !== MultiCommitOperationKind.CherryPick
    ) {
      log.error(
        '[setCherryPickBranchCreated] - Not in cherry-pick operation state'
      )
      return
    }

    // An update is not emitted here because there is no need
    // to trigger a re-render at this point. (storing for later)
    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        operationDetail: { ...opState.operationDetail, branchCreated },
      })
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setDragElement(dragElement: DragElement | null): Promise<void> {
    this.currentDragElement = dragElement
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _getBranchAheadBehind(
    repository: Repository,
    branch: Branch
  ): Promise<IAheadBehind | null> {
    return getBranchAheadBehind(repository, branch)
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

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _addBranchToForcePushList = (
    repository: Repository,
    tipWithBranch: IValidBranch,
    beforeChangeSha: string
  ) => {
    // if the commit id of the branch is unchanged, it can be excluded from
    // this list
    if (tipWithBranch.branch.tip.sha === beforeChangeSha) {
      return
    }

    const currentState = this.repositoryStateCache.get(repository)
    const { forcePushBranches } = currentState.branchesState

    const updatedMap = new Map<string, string>(forcePushBranches)
    updatedMap.set(
      tipWithBranch.branch.nameWithoutRemote,
      tipWithBranch.branch.tip.sha
    )

    this.repositoryStateCache.updateBranchesState(repository, () => ({
      forcePushBranches: updatedMap,
    }))
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _setMultiCommitOperationUndoState(
    repository: Repository,
    tip: IValidBranch
  ): void {
    // An update is not emitted here because there is no need
    // to trigger a re-render at this point. (storing for later)
    this.repositoryStateCache.updateMultiCommitOperationUndoState(
      repository,
      () => ({
        undoSha: getTipSha(tip),
        branchName: tip.branch.name,
      })
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setMultiCommitOperationStep(
    repository: Repository,
    step: MultiCommitOperationStep
  ): Promise<void> {
    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        step,
      })
    )

    this.emitUpdate()
  }

  public _setMultiCommitOperationTargetBranch(
    repository: Repository,
    targetBranch: Branch
  ): void {
    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        targetBranch,
      })
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _endMultiCommitOperation(repository: Repository): void {
    this.repositoryStateCache.clearMultiCommitOperationState(repository)
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _initializeMultiCommitOperation(
    repository: Repository,
    operationDetail: MultiCommitOperationDetail,
    targetBranch: Branch | null,
    commits: ReadonlyArray<Commit | CommitOneLine>,
    originalBranchTip: string | null,
    emitUpdate: boolean = true
  ): void {
    this.repositoryStateCache.initializeMultiCommitOperationState(repository, {
      step: {
        kind: MultiCommitOperationStepKind.ShowProgress,
      },
      operationDetail,
      progress: {
        kind: 'multiCommitOperation',
        currentCommitSummary: commits.length > 0 ? commits[0].summary : '',
        position: 1,
        totalCommitCount: commits.length,
        value: 0,
      },
      userHasResolvedConflicts: false,
      originalBranchTip,
      targetBranch,
    })

    if (!emitUpdate) {
      return
    }

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

  public _setPullRequestFileListWidth(width: number): Promise<void> {
    this.pullRequestFileListWidth = {
      ...this.pullRequestFileListWidth,
      value: width,
    }
    setNumber(pullRequestFileListConfigKey, width)
    this.updatePullRequestResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public _resetPullRequestFileListWidth(): Promise<void> {
    this.pullRequestFileListWidth = {
      ...this.pullRequestFileListWidth,
      value: defaultPullRequestFileListWidth,
    }
    localStorage.removeItem(pullRequestFileListConfigKey)
    this.updatePullRequestResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

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
