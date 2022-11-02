import {
  AccountsStore,
  CloningRepositoriesStore,
  GitHubUserStore,
  GitStore,
  SignInStore,
} from '.'
import { Account } from '../../models/account'
import { AppMenu, IMenu } from '../../models/app-menu'
import { IAuthor } from '../../models/author'
import { Branch, BranchType, IAheadBehind } from '../../models/branch'
import { BranchesTab } from '../../models/branches-tab'
import { CloneRepositoryTab } from '../../models/clone-repository-tab'
import { CloningRepository } from '../../models/cloning-repository'
import { Commit, ICommitContext, CommitOneLine } from '../../models/commit'
import {
  DiffSelection,
  DiffSelectionType,
  DiffType,
  ImageDiffType,
} from '../../models/diff'
import {
  hasWritePermission,
} from '../../models/github-repository'
import { PullRequest } from '../../models/pull-request'
import {
  remoteEquals,
} from '../../models/remote'
import {
  ILocalRepositoryState,
  Repository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
  AppFileStatusKind,
} from '../../models/status'
import { TipState, tipEquals, IValidBranch } from '../../models/tip'
import { ICommitMessage } from '../../models/commit-message'
import {
  IMultiCommitOperationProgress,
} from '../../models/progress'
import { Popup, PopupType } from '../../models/popup'
import { IGitAccount } from '../../models/git-account'
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
  updatePreferredAppMenuItemLabels,
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
  CompareAction,
  HistoryTabMode,
  Foldout,
  FoldoutType,
  IAppState,
  ICompareBranch,
  ICompareFormUpdate,
  ICompareToBranch,
  IDisplayHistory,
  PossibleSelections,
  RepositorySectionTab,
  SelectionType,
  IRepositoryState,
  ChangesSelectionKind,
  ChangesWorkingDirectorySelection,
  isRebaseConflictState,
  isCherryPickConflictState,
  isMergeConflictState,
  IMultiCommitOperationState,
  IConstrainedValue,
  ICompareState,
} from '../app-state'
import {
  findEditorOrDefault,
  getAvailableEditors,
  launchExternalEditor,
} from '../editors'
import { assertNever, forceUnwrap } from '../fatal-error'

import { formatCommitMessage } from '../format-commit-message'
import { getGenericHostname, getGenericUsername } from '../generic-git-auth'
import { getAccountForRepository } from '../get-account-for-repository'
import {
  abortMerge,
  getAuthorIdentity,
  getChangedFiles,
  getCommitDiff,
  getWorkingDirectoryDiff,
  createMergeCommit,
  getBranchesPointedAt,
  abortRebase,
  continueRebase,
  rebase,
  RebaseResult,
  getRebaseSnapshot,
  IStatusResult,
  GitResetMode,
  reset,
  getBranchAheadBehind,
  getRebaseInternalState,
  getCommit,
  getCommitRangeDiff,
  getCommitRangeChangedFiles,
  getBranchMergeBaseChangedFiles,
  getBranchMergeBaseDiff,
} from '../git'
import {
  installGlobalLFSFilters,
  installLFSHooks,
} from '../git/lfs'
import { updateMenuState } from '../menu-update'
import { merge } from '../merge'
import {
  matchGitHubRepository,
} from '../repository-matching'
import { isCurrentBranchForcePush } from '../rebase'
import { RetryAction, RetryActionType } from '../../models/retry-actions'
import {
  Default as DefaultShell,
  findShellOrDefault,
  launchShell,
  parse as parseShell,
  Shell,
} from '../shells'
import { ILaunchStats, StatsStore } from '../stats'
import { hasShownWelcomeFlow, markWelcomeFlowComplete } from '../welcome'
import { WindowState } from '../window-state'
import { TypedBaseStore } from './base-store'
import { MergeTreeResult } from '../../models/merge'
import { promiseWithMinimumTimeout } from '../promise'
import { RepositoryStateCache } from './repository-state-cache'
// import { readEmoji } from '../read-emoji'
import { GitStoreCache } from './git-store-cache'
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
import {
  updateChangedFiles,
  updateConflictState,
  selectWorkingDirectoryFiles,
} from './updates/changes-state'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { enableMultiCommitDiffs } from '../feature-flag'
import { Banner, BannerType } from '../../models/banner'
import { ComputedAction } from '../../models/computed-action'
import {
  dropDesktopStashEntry,
} from '../git/stash'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../../models/uncommitted-changes-strategy'
import { IStashEntry, StashedChangesLoadStates } from '../../models/stash-entry'
import { arrayEquals } from '../equality'
import { MenuLabelsEvent } from '../../models/menu-labels'
import { findRemoteBranchName } from './helpers/find-branch-name'
import {
  TutorialStep,
  orderedTutorialSteps,
  isValidTutorialStep,
} from '../../models/tutorial-step'
import { OnboardingTutorialAssessor } from './helpers/tutorial-assessor'
import { isBranchPushable } from '../helpers/push-control'
import {
  findAssociatedPullRequest,
  isPullRequestAssociatedWithBranch,
} from '../helpers/pull-request-matching'
import { parseRemote } from '../../lib/remote-parsing'
import {
  ShowSideBySideDiffDefault,
  getShowSideBySideDiff,
  setShowSideBySideDiff,
} from '../../ui/lib/diff-mode'
import {
  CherryPickResult,
  continueCherryPick,
  getCherryPickSnapshot,
} from '../git/cherry-pick'
import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'
import { squash } from '../git/squash'
import { getTipSha } from '../tip'
import {
  MultiCommitOperationDetail,
  MultiCommitOperationKind,
  MultiCommitOperationStep,
  MultiCommitOperationStepKind,
} from '../../models/multi-commit-operation'
import { reorder } from '../git/reorder'
import { UseWindowsOpenSSHKey } from '../ssh/ssh'
import { isConflictsFlow } from '../multi-commit-operation'
import { clamp } from '../clamp'
import { EndpointToken } from '../endpoint-token'
import {
  NotificationsStore,
  getNotificationsEnabled,
} from './notifications-store'
import * as ipcRenderer from '../ipc-renderer'
import { findContributionTargetDefaultBranch } from '../branch'
import { determineMergeability } from '../git/merge-tree'

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
  private readonly gitStoreCache: GitStoreCache

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()
  private repositories: ReadonlyArray<Repository> = new Array<Repository>()
  private recentRepositories: ReadonlyArray<number> = new Array<number>()

  private selectedRepository: Repository | CloningRepository | null = null

  private showWelcomeFlow = false
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

  private currentMergeTreePromise: Promise<void> | null = null

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
    private readonly cloningRepositoriesStore: CloningRepositoriesStore,
    // private readonly issuesStore: IssuesStore,
    private readonly statsStore: StatsStore,
    private readonly signInStore: SignInStore,
    private readonly accountsStore: AccountsStore,
    // private readonly repositoriesStore: RepositoriesStore,
    // private readonly pullRequestCoordinator: PullRequestCoordinator,
    private readonly repositoryStateCache: RepositoryStateCache,
    private readonly apiRepositoriesStore: ApiRepositoriesStore,
    private readonly notificationsStore: NotificationsStore
  ) {
    super()

    this.showWelcomeFlow = !hasShownWelcomeFlow()

    if (__WIN32__) {
      const useWindowsOpenSSH = getBoolean(UseWindowsOpenSSHKey)

      // If the user never selected whether to use Windows OpenSSH or not, use it
      // by default if we have to show the welcome flow (i.e. if it's a new install)
      if (useWindowsOpenSSH === undefined) {
        this._setUseWindowsOpenSSH(this.showWelcomeFlow)
      } else {
        this.useWindowsOpenSSH = useWindowsOpenSSH
      }
    }

    this.gitStoreCache = new GitStoreCache(
      shell,
      this.statsStore,
      (repo, store) => this.onGitStoreUpdated(repo, store),
      error => this.emitError(error)
    )

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

    this.cloningRepositoriesStore.onDidUpdate(() => {
      this.emitUpdate()
    })

    this.cloningRepositoriesStore.onDidError(e => this.emitError(e))

    this.signInStore.onDidAuthenticate((account, method) => {
      this._addAccount(account)

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

  private getSelectedState(): PossibleSelections | null {
    const repository = this.selectedRepository
    if (!repository) {
      return null
    }

    if (repository instanceof CloningRepository) {
      const progress =
        this.cloningRepositoriesStore.getRepositoryState(repository)
      if (!progress) {
        return null
      }

      return {
        type: SelectionType.CloningRepository,
        repository,
        progress,
      }
    }

    if (repository.missing) {
      return { type: SelectionType.MissingRepository, repository }
    }

    return {
      type: SelectionType.Repository,
      repository,
      state: this.repositoryStateCache.get(repository),
    }
  }

  public getState(): IAppState {
    const repositories = [
      ...this.repositories,
      ...this.cloningRepositoriesStore.repositories,
    ]

    return {
      userList: this.userList,
      accounts: this.accounts,
      repositories,
      recentRepositories: this.recentRepositories,
      localRepositoryStateLookup: this.localRepositoryStateLookup,
      windowState: this.windowState,
      windowZoomFactor: this.windowZoomFactor,
      appIsFocused: this.appIsFocused,
      selectedState: this.getSelectedState(),
      signInState: this.signInStore.getState(),
      currentPopup: this.currentPopup,
      currentFoldout: this.currentFoldout,
      errors: this.errors,
      showWelcomeFlow: this.showWelcomeFlow,
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

  private onGitStoreUpdated(repository: Repository, gitStore: GitStore) {
    const prevRepositoryState = this.repositoryStateCache.get(repository)

    this.repositoryStateCache.updateBranchesState(repository, state => {
      let { currentPullRequest } = state
      const { tip, currentRemote: remote } = gitStore

      // If the tip has changed we need to re-evaluate whether or not the
      // current pull request is still valid. Note that we're not using
      // updateCurrentPullRequest here because we know for certain that
      // the list of open pull requests haven't changed so we can find
      // a happy path where the tip has changed but the current PR is
      // still valid which doesn't require us to iterate through the
      // list of open PRs.
      if (
        !tipEquals(state.tip, tip) ||
        !remoteEquals(prevRepositoryState.remote, remote)
      ) {
        if (tip.kind !== TipState.Valid || remote === null) {
          // The tip isn't a branch so or the current branch doesn't have a remote
          // so there can't be a current pull request.
          currentPullRequest = null
        } else {
          const { branch } = tip

          if (
            !currentPullRequest ||
            !isPullRequestAssociatedWithBranch(
              branch,
              currentPullRequest,
              remote
            )
          ) {
            // Either we don't have a current pull request or the current pull
            // request no longer matches the tip, let's go hunting for a new one.
            const prs = state.openPullRequests
            currentPullRequest = findAssociatedPullRequest(branch, prs, remote)
          }

          if (
            tip.kind === TipState.Valid &&
            state.tip.kind === TipState.Valid &&
            tip.branch.name !== state.tip.branch.name
          ) {
            this.refreshBranchProtectionState(repository)
          }
        }
      }

      return {
        tip: gitStore.tip,
        defaultBranch: gitStore.defaultBranch,
        upstreamDefaultBranch: gitStore.upstreamDefaultBranch,
        allBranches: gitStore.allBranches,
        recentBranches: gitStore.recentBranches,
        pullWithRebase: gitStore.pullWithRebase,
        currentPullRequest,
      }
    })

    let selectWorkingDirectory = false
    let selectStashEntry = false

    this.repositoryStateCache.updateChangesState(repository, state => {
      const stashEntry = gitStore.currentBranchStashEntry

      // Figure out what selection changes we need to make as a result of this
      // change.
      if (state.selection.kind === ChangesSelectionKind.Stash) {
        if (state.stashEntry !== null) {
          if (stashEntry === null) {
            // We're showing a stash now and the stash entry has just disappeared
            // so we need to switch back over to the working directory.
            selectWorkingDirectory = true
          } else if (state.stashEntry.stashSha !== stashEntry.stashSha) {
            // The current stash entry has changed from underneath so we must
            // ensure we have a valid selection.
            selectStashEntry = true
          }
        }
      }

      return {
        commitMessage: gitStore.commitMessage,
        showCoAuthoredBy: gitStore.showCoAuthoredBy,
        coAuthors: gitStore.coAuthors,
        stashEntry,
      }
    })

    this.repositoryStateCache.update(repository, () => ({
      commitLookup: gitStore.commitLookup,
      localCommitSHAs: gitStore.localCommitSHAs,
      localTags: gitStore.localTags,
      aheadBehind: gitStore.aheadBehind,
      tagsToPush: gitStore.tagsToPush,
      remote: gitStore.currentRemote,
      lastFetched: gitStore.lastFetched,
    }))

    // _selectWorkingDirectoryFiles and _selectStashedFile will
    // emit updates by themselves.
    if (selectWorkingDirectory) {
      this._selectWorkingDirectoryFiles(repository)
    } else if (selectStashEntry) {
      this._selectStashedFile(repository)
    } else {
      this.emitUpdate()
    }
  }

  private async refreshBranchProtectionState(repository: Repository) {
    const { tip, currentRemote } = this.gitStoreCache.get(repository)

    if (tip.kind !== TipState.Valid || repository.gitHubRepository === null) {
      return
    }

    const gitHubRepo = repository.gitHubRepository
    const branchName = findRemoteBranchName(tip, currentRemote, gitHubRepo)

    if (branchName !== null) {
      const account = getAccountForEndpoint(this.accounts, gitHubRepo.endpoint)

      if (account === null) {
        return
      }

      // If the user doesn't have write access to the repository
      // it doesn't matter if the branch is protected or not and
      // we can avoid the API call. See the `showNoWriteAccess`
      // prop in the `CommitMessage` component where we specifically
      // test for this scenario and show a message specifically
      // about write access before showing a branch protection
      // warning.
      if (!hasWritePermission(gitHubRepo)) {
        this.repositoryStateCache.updateChangesState(repository, () => ({
          currentBranchProtected: false,
        }))
        this.emitUpdate()
        return
      }

      const name = gitHubRepo.name
      const owner = gitHubRepo.owner.login
      const api = API.fromAccount(account)

      const pushControl = await api.fetchPushControl(owner, name, branchName)
      const currentBranchProtected = !isBranchPushable(pushControl)

      this.repositoryStateCache.updateChangesState(repository, () => ({
        currentBranchProtected,
      }))
      this.emitUpdate()
    }
  }

  private clearSelectedCommit(repository: Repository) {
    this.repositoryStateCache.updateCommitSelection(repository, () => ({
      shas: [],
      file: null,
      changesetData: { files: [], linesAdded: 0, linesDeleted: 0 },
      diff: null,
    }))
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

  private updateOrSelectFirstCommit(
    repository: Repository,
    commitSHAs: ReadonlyArray<string>
  ) {
    const state = this.repositoryStateCache.get(repository)
    let selectedSHA =
      state.commitSelection.shas.length > 0
        ? state.commitSelection.shas[0]
        : null

    if (selectedSHA != null) {
      const index = commitSHAs.findIndex(sha => sha === selectedSHA)
      if (index < 0) {
        // selected SHA is not in this list
        // -> clear the selection in the app state
        selectedSHA = null
        this.clearSelectedCommit(repository)
      }
    }

    if (selectedSHA === null && commitSHAs.length > 0) {
      this._changeCommitSelection(repository, [commitSHAs[0]], true)
      this._loadChangedFilesForCurrentSelection(repository)
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _initializeCompare(
    repository: Repository,
    initialAction?: CompareAction
  ) {
    const state = this.repositoryStateCache.get(repository)

    const { branchesState, compareState } = state
    const { tip } = branchesState
    const currentBranch = tip.kind === TipState.Valid ? tip.branch : null

    const branches = branchesState.allBranches.filter(
      b => b.name !== currentBranch?.name && !b.isDesktopForkRemoteBranch
    )
    const recentBranches = currentBranch
      ? branchesState.recentBranches.filter(b => b.name !== currentBranch.name)
      : branchesState.recentBranches

    const cachedDefaultBranch = branchesState.defaultBranch

    // only include the default branch when comparing if the user is not on the default branch
    // and it also exists in the repository
    const defaultBranch =
      currentBranch != null &&
        cachedDefaultBranch != null &&
        currentBranch.name !== cachedDefaultBranch.name
        ? cachedDefaultBranch
        : null

    this.repositoryStateCache.updateCompareState(repository, () => ({
      branches,
      recentBranches,
      defaultBranch,
    }))

    const cachedState = compareState.formState
    const action =
      initialAction != null ? initialAction : getInitialAction(cachedState)
    this._executeCompare(repository, action)
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _executeCompare(
    repository: Repository,
    action: CompareAction
  ): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    const kind = action.kind

    if (action.kind === HistoryTabMode.History) {
      const { tip } = gitStore

      let currentSha: string | null = null

      if (tip.kind === TipState.Valid) {
        currentSha = tip.branch.tip.sha
      } else if (tip.kind === TipState.Detached) {
        currentSha = tip.currentSha
      }

      const { compareState } = this.repositoryStateCache.get(repository)
      const { formState, commitSHAs } = compareState
      const previousTip = compareState.tip

      const tipIsUnchanged =
        currentSha !== null &&
        previousTip !== null &&
        currentSha === previousTip

      if (
        tipIsUnchanged &&
        formState.kind === HistoryTabMode.History &&
        commitSHAs.length > 0
      ) {
        // don't refresh the history view here because we know nothing important
        // has changed and we don't want to rebuild this state
        return
      }

      // load initial group of commits for current branch
      const commits = await gitStore.loadCommitBatch('HEAD', 0)

      if (commits === null) {
        return
      }

      const newState: IDisplayHistory = {
        kind: HistoryTabMode.History,
      }

      this.repositoryStateCache.updateCompareState(repository, () => ({
        tip: currentSha,
        formState: newState,
        commitSHAs: commits,
        filterText: '',
        showBranchList: false,
      }))
      this.updateOrSelectFirstCommit(repository, commits)

      return this.emitUpdate()
    }

    if (action.kind === HistoryTabMode.Compare) {
      return this.updateCompareToBranch(repository, action)
    }

    return assertNever(action, `Unknown action: ${kind}`)
  }

  private async updateCompareToBranch(
    repository: Repository,
    action: ICompareToBranch
  ) {
    const gitStore = this.gitStoreCache.get(repository)

    const comparisonBranch = action.branch
    const compare = await gitStore.getCompareCommits(
      comparisonBranch,
      action.comparisonMode
    )

    this.statsStore.recordBranchComparison()
    const { branchesState } = this.repositoryStateCache.get(repository)

    if (
      branchesState.defaultBranch !== null &&
      comparisonBranch.name === branchesState.defaultBranch.name
    ) {
      this.statsStore.recordDefaultBranchComparison()
    }

    if (compare == null) {
      return
    }

    const { ahead, behind } = compare
    const aheadBehind = { ahead, behind }

    const commitSHAs = compare.commits.map(commit => commit.sha)

    const newState: ICompareBranch = {
      kind: HistoryTabMode.Compare,
      comparisonBranch,
      comparisonMode: action.comparisonMode,
      aheadBehind,
    }

    this.repositoryStateCache.updateCompareState(repository, s => ({
      formState: newState,
      filterText: comparisonBranch.name,
      commitSHAs,
    }))

    const tip = gitStore.tip

    const loadingMerge: MergeTreeResult = {
      kind: ComputedAction.Loading,
    }

    this.repositoryStateCache.updateCompareState(repository, () => ({
      mergeStatus: loadingMerge,
    }))

    this.emitUpdate()

    this.updateOrSelectFirstCommit(repository, commitSHAs)

    if (this.currentMergeTreePromise != null) {
      return this.currentMergeTreePromise
    }

    if (tip.kind === TipState.Valid && aheadBehind.behind > 0) {
      this.currentMergeTreePromise = this.setupMergabilityPromise(
        repository,
        tip.branch,
        action.branch
      )
        .then(mergeStatus => {
          this.repositoryStateCache.updateCompareState(repository, () => ({
            mergeStatus,
          }))

          this.emitUpdate()
        })
        .finally(() => {
          this.currentMergeTreePromise = null
        })

      return this.currentMergeTreePromise
    } else {
      this.repositoryStateCache.updateCompareState(repository, () => ({
        mergeStatus: null,
      }))

      return this.emitUpdate()
    }
  }

  private setupMergabilityPromise(
    repository: Repository,
    baseBranch: Branch,
    compareBranch: Branch
  ) {
    return promiseWithMinimumTimeout(
      () => determineMergeability(repository, baseBranch, compareBranch),
      500
    ).catch(err => {
      log.warn(
        `Error occurred while trying to merge ${baseBranch.name} (${baseBranch.tip.sha}) and ${compareBranch.name} (${compareBranch.tip.sha})`,
        err
      )
      return null
    })
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
  public async _loadNextCommitBatch(repository: Repository): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)

    const state = this.repositoryStateCache.get(repository)
    const { formState } = state.compareState
    if (formState.kind === HistoryTabMode.History) {
      const commits = state.compareState.commitSHAs

      const newCommits = await gitStore.loadCommitBatch('HEAD', commits.length)
      if (newCommits == null) {
        return
      }

      this.repositoryStateCache.updateCompareState(repository, () => ({
        commitSHAs: commits.concat(newCommits),
      }))
      this.emitUpdate()
    }
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _loadChangedFilesForCurrentSelection(
    repository: Repository
  ): Promise<void> {
    const state = this.repositoryStateCache.get(repository)
    const { commitSelection } = state
    const { shas: currentSHAs, isContiguous } = commitSelection
    if (
      currentSHAs.length === 0 ||
      (currentSHAs.length > 1 && (!enableMultiCommitDiffs() || !isContiguous))
    ) {
      return
    }

    const gitStore = this.gitStoreCache.get(repository)
    const changesetData = await gitStore.performFailableOperation(() =>
      currentSHAs.length > 1
        ? getCommitRangeChangedFiles(repository, currentSHAs)
        : getChangedFiles(repository, currentSHAs[0])
    )
    if (!changesetData) {
      return
    }

    // The selection could have changed between when we started loading the
    // changed files and we finished. We might wanna store the changed files per
    // SHA/path.
    if (
      commitSelection.shas.length !== currentSHAs.length ||
      !commitSelection.shas.every((sha, i) => sha === currentSHAs[i])
    ) {
      return
    }

    // if we're selecting a commit for the first time, we should select the
    // first file in the commit and render the diff immediately

    const noFileSelected = commitSelection.file === null

    const firstFileOrDefault =
      noFileSelected && changesetData.files.length
        ? changesetData.files[0]
        : commitSelection.file

    this.repositoryStateCache.updateCommitSelection(repository, () => ({
      file: firstFileOrDefault,
      changesetData,
      diff: null,
    }))

    this.emitUpdate()

    if (firstFileOrDefault !== null) {
      this._changeFileSelection(repository, firstFileOrDefault)
    }
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

    this.updateMenuLabelsForSelectedRepository()

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

  /**
   * Update menu labels for the selected repository.
   *
   * If selected repository type is a `CloningRepository` or
   * `MissingRepository`, the menu labels will be updated but they will lack
   * the expected `IRepositoryState` and revert to the default values.
   */
  private updateMenuLabelsForSelectedRepository() {
    const { selectedState } = this.getState()

    if (
      selectedState !== null &&
      selectedState.type === SelectionType.Repository
    ) {
      this.updateMenuItemLabels(selectedState.state)
    } else {
      this.updateMenuItemLabels(null)
    }
  }

  /**
   * Update the menus in the main process using the provided repository state
   *
   * @param state the current repository state, or `null` if the repository is
   *              being cloned or is missing
   */
  private updateMenuItemLabels(state: IRepositoryState | null) {
    const {
      selectedShell,
      selectedRepository,
      selectedExternalEditor,
      askForConfirmationOnRepositoryRemoval,
      askForConfirmationOnForcePush,
    } = this

    const labels: MenuLabelsEvent = {
      selectedShell,
      selectedExternalEditor,
      askForConfirmationOnRepositoryRemoval,
      askForConfirmationOnForcePush,
    }

    if (state === null) {
      updatePreferredAppMenuItemLabels(labels)
      return
    }

    const { changesState, branchesState, aheadBehind } = state
    const { currentPullRequest } = branchesState

    let contributionTargetDefaultBranch: string | undefined
    if (selectedRepository instanceof Repository) {
      contributionTargetDefaultBranch =
        findContributionTargetDefaultBranch(selectedRepository, branchesState)
          ?.name ?? undefined
    }

    const isForcePushForCurrentRepository = isCurrentBranchForcePush(
      branchesState,
      aheadBehind
    )

    const isStashedChangesVisible =
      changesState.selection.kind === ChangesSelectionKind.Stash

    const askForConfirmationWhenStashingAllChanges =
      changesState.stashEntry !== null

    updatePreferredAppMenuItemLabels({
      ...labels,
      contributionTargetDefaultBranch,
      isForcePushForCurrentRepository,
      isStashedChangesVisible,
      hasCurrentPullRequest: currentPullRequest !== null,
      askForConfirmationWhenStashingAllChanges,
    })
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

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _loadStatus(
    repository: Repository,
    clearPartialState: boolean = false
  ): Promise<IStatusResult | null> {
    const gitStore = this.gitStoreCache.get(repository)
    const status = await gitStore.loadStatus()

    if (status === null) {
      return null
    }

    this.repositoryStateCache.updateChangesState(repository, state =>
      updateChangedFiles(state, status, clearPartialState)
    )

    this.repositoryStateCache.updateChangesState(repository, state => ({
      conflictState: updateConflictState(state, status, this.statsStore),
    }))

    this.updateMultiCommitOperationConflictsIfFound(repository)
    await this.initializeMultiCommitOperationIfConflictsFound(
      repository,
      status
    )

    if (this.selectedRepository === repository) {
      this._triggerConflictsFlow(repository, status)
    }

    this.emitUpdate()

    this.updateChangesWorkingDirectoryDiff(repository)

    return status
  }

  /**
   * This method is to initialize a multi commit operation state on app load
   * if conflicts are found but not multi commmit operation exists.
   */
  private async initializeMultiCommitOperationIfConflictsFound(
    repository: Repository,
    status: IStatusResult
  ) {
    const state = this.repositoryStateCache.get(repository)
    const {
      changesState: { conflictState },
      multiCommitOperationState,
      branchesState,
    } = state

    if (conflictState === null) {
      this.clearConflictsFlowVisuals(state)
      return
    }

    if (multiCommitOperationState !== null) {
      return
    }

    let operationDetail: MultiCommitOperationDetail
    let targetBranch: Branch | null = null
    let commits: ReadonlyArray<Commit | CommitOneLine> = []
    let originalBranchTip: string | null = ''
    let progress: IMultiCommitOperationProgress | undefined = undefined

    if (branchesState.tip.kind === TipState.Valid) {
      targetBranch = branchesState.tip.branch
      originalBranchTip = targetBranch.tip.sha
    }

    if (isMergeConflictState(conflictState)) {
      operationDetail = {
        kind: MultiCommitOperationKind.Merge,
        isSquash: status.squashMsgFound,
        sourceBranch: null,
      }
      originalBranchTip = targetBranch !== null ? targetBranch.tip.sha : null
    } else if (isRebaseConflictState(conflictState)) {
      const snapshot = await getRebaseSnapshot(repository)
      const rebaseState = await getRebaseInternalState(repository)
      if (snapshot === null || rebaseState === null) {
        return
      }

      originalBranchTip = rebaseState.originalBranchTip
      commits = snapshot.commits
      progress = snapshot.progress
      operationDetail = {
        kind: MultiCommitOperationKind.Rebase,
        sourceBranch: null,
        commits,
        currentTip: rebaseState.baseBranchTip,
      }

      const commit = await getCommit(repository, rebaseState.originalBranchTip)

      if (commit !== null) {
        targetBranch = new Branch(
          rebaseState.targetBranch,
          null,
          commit,
          BranchType.Local,
          `refs/heads/${rebaseState.targetBranch}`
        )
      }
    } else if (isCherryPickConflictState(conflictState)) {
      const snapshot = await getCherryPickSnapshot(repository)
      if (snapshot === null) {
        return
      }

      originalBranchTip = null
      commits = snapshot.commits
      progress = snapshot.progress
      operationDetail = {
        kind: MultiCommitOperationKind.CherryPick,
        sourceBranch: null,
        branchCreated: false,
        commits,
      }

      this.repositoryStateCache.updateMultiCommitOperationUndoState(
        repository,
        () => ({
          undoSha: snapshot.targetBranchUndoSha,
          branchName: '',
        })
      )
    } else {
      assertNever(conflictState, `Unsupported conflict kind`)
    }

    this._initializeMultiCommitOperation(
      repository,
      operationDetail,
      targetBranch,
      commits,
      originalBranchTip,
      false
    )

    if (progress === undefined) {
      return
    }

    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        progress: progress as IMultiCommitOperationProgress,
      })
    )
  }
  /**
   * Push changes from latest conflicts into current multi step operation step, if needed
   *  - i.e. - multiple instance of running in to conflicts
   */
  private updateMultiCommitOperationConflictsIfFound(repository: Repository) {
    const state = this.repositoryStateCache.get(repository)
    const { changesState, multiCommitOperationState } =
      this.repositoryStateCache.get(repository)
    const { conflictState } = changesState

    if (conflictState === null || multiCommitOperationState === null) {
      this.clearConflictsFlowVisuals(state)
      return
    }

    const { step, operationDetail } = multiCommitOperationState
    if (step.kind !== MultiCommitOperationStepKind.ShowConflicts) {
      return
    }

    const { manualResolutions } = conflictState

    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        step: { ...step, manualResolutions },
      })
    )

    if (isRebaseConflictState(conflictState)) {
      const { currentTip } = conflictState
      this.repositoryStateCache.updateMultiCommitOperationState(
        repository,
        () => ({ operationDetail: { ...operationDetail, currentTip } })
      )
    }
  }

  private async _triggerConflictsFlow(
    repository: Repository,
    status: IStatusResult
  ) {
    const state = this.repositoryStateCache.get(repository)
    const {
      changesState: { conflictState },
      multiCommitOperationState,
    } = state

    if (conflictState === null) {
      this.clearConflictsFlowVisuals(state)
      return
    }

    if (multiCommitOperationState === null) {
      return
    }

    const displayingBanner =
      this.currentBanner !== null &&
      this.currentBanner.type === BannerType.ConflictsFound

    if (
      displayingBanner ||
      isConflictsFlow(this.currentPopup, multiCommitOperationState)
    ) {
      return
    }

    const { manualResolutions } = conflictState
    let ourBranch, theirBranch

    if (isMergeConflictState(conflictState)) {
      theirBranch = await this.getMergeConflictsTheirBranch(
        repository,
        status.squashMsgFound,
        multiCommitOperationState
      )
      ourBranch = conflictState.currentBranch
    } else if (isRebaseConflictState(conflictState)) {
      theirBranch = conflictState.targetBranch
      ourBranch = conflictState.baseBranch
    } else if (isCherryPickConflictState(conflictState)) {
      if (
        multiCommitOperationState !== null &&
        multiCommitOperationState.operationDetail.kind ===
        MultiCommitOperationKind.CherryPick &&
        multiCommitOperationState.operationDetail.sourceBranch !== null
      ) {
        theirBranch =
          multiCommitOperationState.operationDetail.sourceBranch.name
      }
      ourBranch = conflictState.targetBranchName
    } else {
      assertNever(conflictState, `Unsupported conflict kind`)
    }

    this._setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.ShowConflicts,
      conflictState: {
        kind: 'multiCommitOperation',
        manualResolutions,
        ourBranch,
        theirBranch,
      },
    })

    this._showPopup({
      type: PopupType.MultiCommitOperation,
      repository,
    })
  }

  private async getMergeConflictsTheirBranch(
    repository: Repository,
    isSquash: boolean,
    multiCommitOperationState: IMultiCommitOperationState | null
  ): Promise<string | undefined> {
    let theirBranch: string | undefined
    if (
      multiCommitOperationState !== null &&
      multiCommitOperationState.operationDetail.kind ===
      MultiCommitOperationKind.Merge &&
      multiCommitOperationState.operationDetail.sourceBranch !== null
    ) {
      theirBranch = multiCommitOperationState.operationDetail.sourceBranch.name
    }

    if (theirBranch === undefined && !isSquash) {
      const possibleTheirsBranches = await getBranchesPointedAt(
        repository,
        'MERGE_HEAD'
      )

      // null means we encountered an error
      if (possibleTheirsBranches === null) {
        return
      }

      theirBranch =
        possibleTheirsBranches.length === 1
          ? possibleTheirsBranches[0]
          : undefined
    }
    return theirBranch
  }

  /**
   * Cleanup any related UI related to conflicts if still in use.
   */
  private clearConflictsFlowVisuals(state: IRepositoryState) {
    const { multiCommitOperationState } = state
    if (
      userIsStartingMultiCommitOperation(
        this.currentPopup,
        multiCommitOperationState
      )
    ) {
      return
    }

    this._closePopup(PopupType.MultiCommitOperation)
    this._clearBanner(BannerType.ConflictsFound)
    this._clearBanner(BannerType.MergeConflictsFound)
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _changeRepositorySection(
    repository: Repository,
    selectedSection: RepositorySectionTab
  ): Promise<void> {
    this.repositoryStateCache.update(repository, state => {
      if (state.selectedSection !== selectedSection) {
        this.statsStore.recordRepositoryViewChanged()
      }
      return { selectedSection }
    })
    this.emitUpdate()

    if (selectedSection === RepositorySectionTab.History) {
      return this.refreshHistorySection(repository)
    } else if (selectedSection === RepositorySectionTab.Changes) {
      return this.refreshChangesSection(repository, {
        includingStatus: true,
        clearPartialState: false,
      })
    }
  }

  /**
   * Changes the selection in the changes view to the working directory and
   * optionally selects one or more files from the working directory.
   *
   *  @param files An array of files to select when showing the working directory.
   *               If undefined this method will preserve the previously selected
   *               files or pick the first changed file if no selection exists.
   *
   * Note: This shouldn't be called directly. See `Dispatcher`.
   */
  public async _selectWorkingDirectoryFiles(
    repository: Repository,
    files?: ReadonlyArray<WorkingDirectoryFileChange>
  ): Promise<void> {
    this.repositoryStateCache.updateChangesState(repository, state =>
      selectWorkingDirectoryFiles(state, files)
    )

    this.updateMenuLabelsForSelectedRepository()
    this.emitUpdate()
    this.updateChangesWorkingDirectoryDiff(repository)
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

    this.updateMenuLabelsForSelectedRepository()
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

    this.updateMenuLabelsForSelectedRepository()
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

  /**
   * Refresh all the data for the Changes section.
   *
   * This will be called automatically when appropriate.
   */
  private async refreshChangesSection(
    repository: Repository,
    options: {
      includingStatus: boolean
      clearPartialState: boolean
    }
  ): Promise<void> {
    if (options.includingStatus) {
      await this._loadStatus(repository, options.clearPartialState)
    }

    const gitStore = this.gitStoreCache.get(repository)
    const state = this.repositoryStateCache.get(repository)

    if (state.branchesState.tip.kind === TipState.Valid) {
      const currentBranch = state.branchesState.tip.branch
      await gitStore.loadLocalCommits(currentBranch)
    } else if (state.branchesState.tip.kind === TipState.Unborn) {
      await gitStore.loadLocalCommits(null)
    }
  }

  /**
   * Refresh all the data for the History section.
   *
   * This will be called automatically when appropriate.
   */
  private async refreshHistorySection(repository: Repository): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    const state = this.repositoryStateCache.get(repository)
    const tip = state.branchesState.tip

    if (tip.kind === TipState.Valid) {
      await gitStore.loadLocalCommits(tip.branch)
    }

    return this.updateOrSelectFirstCommit(
      repository,
      state.compareState.commitSHAs
    )
  }

  public async _refreshAuthor(repository: Repository): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    const commitAuthor =
      (await gitStore.performFailableOperation(() =>
        getAuthorIdentity(repository)
      )) || null

    this.repositoryStateCache.update(repository, () => ({
      commitAuthor,
    }))
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
  public async _createTag(repository: Repository, name: string, sha: string) {
    const gitStore = this.gitStoreCache.get(repository)
    await gitStore.createTag(name, sha)
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _deleteTag(repository: Repository, name: string) {
    const gitStore = this.gitStoreCache.get(repository)
    await gitStore.deleteTag(name)
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

  private getAccountForRemoteURL(remote: string): IGitAccount | null {
    const account = matchGitHubRepository(this.accounts, remote)?.account
    if (account !== undefined) {
      const hasValidToken =
        account.token.length > 0 ? 'has token' : 'empty token'
      log.info(
        `[AppStore.getAccountForRemoteURL] account found for remote: ${remote} - ${account.login} (${hasValidToken})`
      )
      return account
    }

    const hostname = getGenericHostname(remote)
    const username = getGenericUsername(hostname)
    if (username != null) {
      log.info(
        `[AppStore.getAccountForRemoteURL] found generic credentials for '${hostname}' and '${username}'`
      )
      return { login: username, endpoint: hostname }
    }

    log.info(
      `[AppStore.getAccountForRemoteURL] no generic credentials found for '${remote}'`
    )

    return null
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _clone(
    url: string,
    path: string,
    options?: { branch?: string; defaultBranch?: string }
  ): {
    promise: Promise<boolean>
    repository: CloningRepository
  } {
    const account = this.getAccountForRemoteURL(url)
    const promise = this.cloningRepositoriesStore.clone(url, path, {
      ...options,
      account,
    })
    const repository = this.cloningRepositoriesStore.repositories.find(
      r => r.url === url && r.path === path
    )!

    promise.then(success => {
      if (success) {
        this.statsStore.recordCloneRepository()
      }
    })

    return { promise, repository }
  }

  public _removeCloningRepository(repository: CloningRepository) {
    this.cloningRepositoriesStore.remove(repository)
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

  public _endWelcomeFlow(): Promise<void> {
    this.showWelcomeFlow = false
    this.emitUpdate()

    markWelcomeFlowComplete()

    this.statsStore.recordWelcomeWizardTerminated()

    return Promise.resolve()
  }

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

  public _setCommitMessage(
    repository: Repository,
    message: ICommitMessage
  ): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    return gitStore.setCommitMessage(message)
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
  public async _rebase(
    repository: Repository,
    baseBranch: Branch,
    targetBranch: Branch
  ): Promise<RebaseResult> {
    const progressCallback =
      this.getMultiCommitOperationProgressCallBack(repository)
    const gitStore = this.gitStoreCache.get(repository)
    const result = await gitStore.performFailableOperation(
      () => rebase(repository, baseBranch, targetBranch, progressCallback),
      {
        retryAction: {
          type: RetryActionType.Rebase,
          repository,
          baseBranch,
          targetBranch,
        },
      }
    )

    return result || RebaseResult.Error
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _abortRebase(repository: Repository) {
    const gitStore = this.gitStoreCache.get(repository)
    return await gitStore.performFailableOperation(() =>
      abortRebase(repository)
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _continueRebase(
    repository: Repository,
    workingDirectory: WorkingDirectoryStatus,
    manualResolutions: ReadonlyMap<string, ManualConflictResolution>
  ): Promise<RebaseResult> {
    const progressCallback =
      this.getMultiCommitOperationProgressCallBack(repository)

    const gitStore = this.gitStoreCache.get(repository)
    const result = await gitStore.performFailableOperation(() =>
      continueRebase(
        repository,
        workingDirectory.files,
        manualResolutions,
        progressCallback
      )
    )

    return result || RebaseResult.Error
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _abortMerge(repository: Repository): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    return await gitStore.performFailableOperation(() => abortMerge(repository))
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _abortSquashMerge(repository: Repository): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    const {
      branchesState,
      changesState: { workingDirectory },
    } = this.repositoryStateCache.get(repository)

    const commitResult = await this._finishConflictedMerge(
      repository,
      workingDirectory,
      new Map<string, ManualConflictResolution>()
    )

    // By committing, we clear out the SQUASH_MSG (and anything else git would
    // choose to store for the --squash merge operation)
    if (commitResult === undefined) {
      log.error(
        `[_abortSquashMerge] - Could not abort squash merge - commiting squash msg failed`
      )
      return
    }

    // Since we have not reloaded the status, this tip is the tip before the
    // squash commit above.
    const { tip } = branchesState
    if (tip.kind !== TipState.Valid) {
      log.error(
        `[_abortSquashMerge] - Could not abort squash merge - tip was invalid`
      )
      return
    }

    await gitStore.performFailableOperation(() =>
      reset(repository, GitResetMode.Hard, tip.branch.tip.sha)
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`.
   *  This method only used in the Merge Conflicts dialog flow,
   *  not committing a conflicted merge via the "Changes" pane.
   */
  public async _finishConflictedMerge(
    repository: Repository,
    workingDirectory: WorkingDirectoryStatus,
    manualResolutions: Map<string, ManualConflictResolution>
  ): Promise<string | undefined> {
    /**
     *  The assumption made here is that all other files that were part of this merge
     *  have already been staged by git automatically (or manually by the user via CLI).
     *  When the user executes a merge and there are conflicts,
     *  git stages all files that are part of the merge that _don't_ have conflicts
     *  This means that we only need to stage the conflicted files
     *  (whether they are manual or markered) to get all changes related to
     *  this merge staged. This also means that any uncommitted changes in the index
     *  that were in place before the merge was started will _not_ be included, unless
     *  the user stages them manually via CLI.
     *
     *  Its also worth noting this method only used in the Merge Conflicts dialog flow, not committing a conflicted merge via the "Changes" pane.
     *
     *  *TLDR we only stage conflicts here because git will have already staged the rest of the changes related to this merge.*
     */
    const conflictedFiles = workingDirectory.files.filter(f => {
      return f.status.kind === AppFileStatusKind.Conflicted
    })
    const gitStore = this.gitStoreCache.get(repository)
    return await gitStore.performFailableOperation(() =>
      createMergeCommit(repository, conflictedFiles, manualResolutions)
    )
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setRemoteURL(
    repository: Repository,
    name: string,
    url: string
  ): Promise<void> {
    const gitStore = this.gitStoreCache.get(repository)
    await gitStore.setRemoteURL(name, url)
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

    this.updateMenuLabelsForSelectedRepository()

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

    this.updateMenuLabelsForSelectedRepository()

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

    this.updateMenuLabelsForSelectedRepository()
    return promise
  }

  public _setShell(shell: Shell): Promise<void> {
    this.selectedShell = shell
    localStorage.setItem(shellKey, shell)
    this.emitUpdate()

    this.updateMenuLabelsForSelectedRepository()

    return Promise.resolve()
  }

  public _changeImageDiffType(type: ImageDiffType): Promise<void> {
    this.imageDiffType = type
    localStorage.setItem(imageDiffTypeKey, JSON.stringify(this.imageDiffType))
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setHideWhitespaceInChangesDiff(
    hideWhitespaceInDiff: boolean,
    repository: Repository
  ): Promise<void> {
    setBoolean(hideWhitespaceInChangesDiffKey, hideWhitespaceInDiff)
    this.hideWhitespaceInChangesDiff = hideWhitespaceInDiff

    return this.refreshChangesSection(repository, {
      includingStatus: true,
      clearPartialState: true,
    })
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

  public _setHideWhitespaceInPullRequestDiff(
    hideWhitespaceInDiff: boolean,
    repository: Repository,
    file: CommittedFileChange | null
  ) {
    setBoolean(hideWhitespaceInPullRequestDiffKey, hideWhitespaceInDiff)
    this.hideWhitespaceInPullRequestDiff = hideWhitespaceInDiff

    if (file !== null) {
      this._changePullRequestFileSelection(repository, file)
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

  public _resetSignInState(): Promise<void> {
    this.signInStore.reset()
    return Promise.resolve()
  }

  public _beginDotComSignIn(): Promise<void> {
    this.signInStore.beginDotComSignIn()
    return Promise.resolve()
  }

  public _beginEnterpriseSignIn(): Promise<void> {
    this.signInStore.beginEnterpriseSignIn()
    return Promise.resolve()
  }

  public _setSignInEndpoint(url: string): Promise<void> {
    return this.signInStore.setEndpoint(url)
  }

  public _setSignInCredentials(
    username: string,
    password: string
  ): Promise<void> {
    return this.signInStore.authenticateWithBasicAuth(username, password)
  }

  public _requestBrowserAuthentication(): Promise<void> {
    return this.signInStore.authenticateWithBrowser()
  }

  public _setSignInOTP(otp: string): Promise<void> {
    return this.signInStore.setTwoFactorOTP(otp)
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

  private async _addAccount(account: Account): Promise<void> {
    log.info(
      `[AppStore] adding account ${account.login} (${account.name}) to store`
    )
    const storedAccount = await this.accountsStore.addAccount(account)

    // If we're in the welcome flow and a user signs in we want to trigger
    // a refresh of the repositories available for cloning straight away
    // in order to have the list of repositories ready for them when they
    // get to the blankslate.
    if (this.showWelcomeFlow && storedAccount !== null) {
      this.apiRepositoriesStore.loadRepositories(storedAccount)
    }
  }

  public async promptForGenericGitAuthentication(
    repository: Repository | CloningRepository,
    retryAction: RetryAction
  ): Promise<void> {
    let url
    if (repository instanceof Repository) {
      const gitStore = this.gitStoreCache.get(repository)
      const remote = gitStore.currentRemote
      if (!remote) {
        return
      }

      url = remote.url
    } else {
      url = repository.url
    }

    const hostname = getGenericHostname(url)
    return this._showPopup({
      type: PopupType.GenericGitAuthentication,
      hostname,
      retryAction,
    })
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
   * Set whether the user has chosen to hide or show the
   * co-authors field in the commit message component
   */
  public _setShowCoAuthoredBy(
    repository: Repository,
    showCoAuthoredBy: boolean
  ) {
    this.gitStoreCache.get(repository).setShowCoAuthoredBy(showCoAuthoredBy)
    return Promise.resolve()
  }

  /**
   * Update the per-repository co-authors list
   *
   * @param repository Co-author settings are per-repository
   * @param coAuthors  Zero or more authors
   */
  public _setCoAuthors(
    repository: Repository,
    coAuthors: ReadonlyArray<IAuthor>
  ) {
    this.gitStoreCache.get(repository).setCoAuthors(coAuthors)
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
  public async _dropStashEntry(
    repository: Repository,
    stashEntry: IStashEntry
  ) {
    const gitStore = this.gitStoreCache.get(repository)
    await gitStore.performFailableOperation(() => {
      return dropDesktopStashEntry(repository, stashEntry.stashSha)
    })
    log.info(
      `[AppStore. _dropStashEntry] dropped stash with commit id ${stashEntry.stashSha}`
    )

    this.statsStore.recordStashDiscard()
    await gitStore.loadStashEntries()
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

  private getMultiCommitOperationProgressCallBack(repository: Repository) {
    return (progress: IMultiCommitOperationProgress) => {
      this.repositoryStateCache.updateMultiCommitOperationState(
        repository,
        () => ({
          progress,
        })
      )
      this.emitUpdate()
    }
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
  public async _continueCherryPick(
    repository: Repository,
    files: ReadonlyArray<WorkingDirectoryFileChange>,
    manualResolutions: ReadonlyMap<string, ManualConflictResolution>
  ): Promise<CherryPickResult> {
    const progressCallback =
      this.getMultiCommitOperationProgressCallBack(repository)

    const gitStore = this.gitStoreCache.get(repository)
    const result = await gitStore.performFailableOperation(() =>
      continueCherryPick(repository, files, manualResolutions, progressCallback)
    )

    return result || CherryPickResult.Error
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setCherryPickProgressFromState(repository: Repository) {
    const snapshot = await getCherryPickSnapshot(repository)
    if (snapshot === null) {
      return
    }

    this.repositoryStateCache.updateMultiCommitOperationState(
      repository,
      () => ({
        progress: snapshot.progress,
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
  public async _reorderCommits(
    repository: Repository,
    commitsToReorder: ReadonlyArray<Commit>,
    beforeCommit: Commit | null,
    lastRetainedCommitRef: string | null
  ): Promise<RebaseResult> {
    if (commitsToReorder.length === 0) {
      log.error('[_reorder] - Unable to reorder. No commits provided.')
      return RebaseResult.Error
    }

    const progressCallback =
      this.getMultiCommitOperationProgressCallBack(repository)
    const gitStore = this.gitStoreCache.get(repository)
    const result = await gitStore.performFailableOperation(() =>
      reorder(
        repository,
        commitsToReorder,
        beforeCommit,
        lastRetainedCommitRef,
        progressCallback
      )
    )

    return result || RebaseResult.Error
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _squash(
    repository: Repository,
    toSquash: ReadonlyArray<Commit>,
    squashOnto: Commit,
    lastRetainedCommitRef: string | null,
    commitContext: ICommitContext
  ): Promise<RebaseResult> {
    if (toSquash.length === 0) {
      log.error('[_squash] - Unable to squash. No commits provided.')
      return RebaseResult.Error
    }

    const progressCallback =
      this.getMultiCommitOperationProgressCallBack(repository)
    const commitMessage = await formatCommitMessage(repository, commitContext)
    const gitStore = this.gitStoreCache.get(repository)
    const result = await gitStore.performFailableOperation(() =>
      squash(
        repository,
        toSquash,
        squashOnto,
        lastRetainedCommitRef,
        commitMessage,
        progressCallback
      )
    )

    return result || RebaseResult.Error
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
  public async _handleConflictsDetectedOnError(
    repository: Repository,
    currentBranch: string,
    theirBranch: string
  ): Promise<void> {
    const { multiCommitOperationState } =
      this.repositoryStateCache.get(repository)

    if (multiCommitOperationState === null) {
      const gitStore = this.gitStoreCache.get(repository)

      const targetBranch = gitStore.allBranches.find(
        branch => branch.name === currentBranch
      )

      if (targetBranch === undefined) {
        return
      }

      const sourceBranch = gitStore.allBranches.find(
        branch => branch.name === theirBranch
      )

      this._initializeMultiCommitOperation(
        repository,
        {
          kind: MultiCommitOperationKind.Merge,
          isSquash: false,
          sourceBranch: sourceBranch ?? null,
        },
        targetBranch,
        [],
        targetBranch.tip.sha
      )
    }

    this._setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.ShowConflicts,
      conflictState: {
        kind: 'multiCommitOperation',
        manualResolutions: new Map<string, ManualConflictResolution>(),
        ourBranch: currentBranch,
        theirBranch,
      },
    })

    return this._showPopup({
      type: PopupType.MultiCommitOperation,
      repository,
    })
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

  public async _startPullRequest(repository: Repository) {
    const { branchesState } = this.repositoryStateCache.get(repository)
    const { defaultBranch, tip } = branchesState

    if (defaultBranch === null || tip.kind !== TipState.Valid) {
      return
    }
    const currentBranch = tip.branch
    this._initializePullRequestPreview(repository, defaultBranch, currentBranch)
  }

  private async _initializePullRequestPreview(
    repository: Repository,
    baseBranch: Branch,
    currentBranch: Branch
  ) {
    const { branchesState, localCommitSHAs } =
      this.repositoryStateCache.get(repository)
    const gitStore = this.gitStoreCache.get(repository)

    const pullRequestCommits = await gitStore.getCommitsBetweenBranches(
      baseBranch,
      currentBranch
    )

    const commitsBetweenBranches = pullRequestCommits.map(c => c.sha)

    // A user may compare two branches with no changes between them.
    const emptyChangeSet = { files: [], linesAdded: 0, linesDeleted: 0 }
    const changesetData =
      commitsBetweenBranches.length > 0
        ? await gitStore.performFailableOperation(() =>
          getBranchMergeBaseChangedFiles(
            repository,
            baseBranch.name,
            currentBranch.name,
            commitsBetweenBranches[0]
          )
        )
        : emptyChangeSet

    if (changesetData === undefined) {
      return
    }

    const hasMergeBase = changesetData !== null
    // We don't care how many commits exist on the unrelated history that
    // can't be merged.
    const commitSHAs = hasMergeBase ? commitsBetweenBranches : []

    this.repositoryStateCache.initializePullRequestState(repository, {
      baseBranch,
      commitSHAs,
      commitSelection: {
        shas: commitSHAs,
        shasInDiff: commitSHAs,
        isContiguous: true,
        changesetData: changesetData ?? emptyChangeSet,
        file: null,
        diff: null,
      },
      mergeStatus:
        commitSHAs.length > 0 || !hasMergeBase
          ? {
            kind: hasMergeBase
              ? ComputedAction.Loading
              : ComputedAction.Invalid,
          }
          : null,
    })

    this.emitUpdate()

    if (commitSHAs.length > 0) {
      this.setupPRMergeTreePromise(repository, baseBranch, currentBranch)
    }

    if (changesetData !== null && changesetData.files.length > 0) {
      await this._changePullRequestFileSelection(
        repository,
        changesetData.files[0]
      )
    }

    const { allBranches, recentBranches, defaultBranch } = branchesState
    const { imageDiffType, selectedExternalEditor, showSideBySideDiff } =
      this.getState()

    this._showPopup({
      type: PopupType.StartPullRequest,
      allBranches,
      currentBranch,
      defaultBranch,
      imageDiffType,
      recentBranches,
      repository,
      externalEditorLabel: selectedExternalEditor ?? undefined,
      nonLocalCommitSHA:
        commitSHAs.length > 0 && !localCommitSHAs.includes(commitSHAs[0])
          ? commitSHAs[0]
          : null,
      showSideBySideDiff,
    })
  }

  public async _changePullRequestFileSelection(
    repository: Repository,
    file: CommittedFileChange
  ): Promise<void> {
    const { branchesState, pullRequestState } =
      this.repositoryStateCache.get(repository)

    if (
      branchesState.tip.kind !== TipState.Valid ||
      pullRequestState === null
    ) {
      return
    }

    const currentBranch = branchesState.tip.branch
    const { baseBranch, commitSHAs } = pullRequestState
    if (commitSHAs === null) {
      return
    }

    this.repositoryStateCache.updatePullRequestCommitSelection(
      repository,
      () => ({
        file,
        diff: null,
      })
    )

    this.emitUpdate()

    if (commitSHAs.length === 0) {
      // Shouldn't happen at this point, but if so moving forward doesn't
      // make sense
      return
    }

    const diff =
      (await this.gitStoreCache
        .get(repository)
        .performFailableOperation(() =>
          getBranchMergeBaseDiff(
            repository,
            file,
            baseBranch.name,
            currentBranch.name,
            this.hideWhitespaceInPullRequestDiff,
            commitSHAs[0]
          )
        )) ?? null

    const { pullRequestState: stateAfterLoad } =
      this.repositoryStateCache.get(repository)
    const selectedFileAfterDiffLoad = stateAfterLoad?.commitSelection?.file

    if (selectedFileAfterDiffLoad?.id !== file.id) {
      // this means user has clicked on another file since loading the diff
      return
    }

    this.repositoryStateCache.updatePullRequestCommitSelection(
      repository,
      () => ({
        diff,
      })
    )

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

  public _updatePullRequestBaseBranch(
    repository: Repository,
    baseBranch: Branch
  ) {
    const { branchesState, pullRequestState } =
      this.repositoryStateCache.get(repository)
    const { tip } = branchesState

    if (tip.kind !== TipState.Valid) {
      return
    }

    if (pullRequestState === null) {
      // This would mean the user submitted PR after requesting base branch
      // update.
      return
    }

    this._initializePullRequestPreview(repository, baseBranch, tip.branch)
  }

  private setupPRMergeTreePromise(
    repository: Repository,
    baseBranch: Branch,
    compareBranch: Branch
  ) {
    this.setupMergabilityPromise(repository, baseBranch, compareBranch).then(
      (mergeStatus: MergeTreeResult | null) => {
        this.repositoryStateCache.updatePullRequestState(repository, () => ({
          mergeStatus,
        }))
        this.emitUpdate()
      }
    )
  }
}

/**
 * Map the cached state of the compare view to an action
 * to perform which is then used to compute the compare
 * view contents.
 */
function getInitialAction(
  cachedState: IDisplayHistory | ICompareBranch
): CompareAction {
  if (cachedState.kind === HistoryTabMode.History) {
    return {
      kind: HistoryTabMode.History,
    }
  }

  const { comparisonMode, comparisonBranch } = cachedState

  return {
    kind: HistoryTabMode.Compare,
    comparisonMode,
    branch: comparisonBranch,
  }
}

function userIsStartingMultiCommitOperation(
  currentPopup: Popup | null,
  state: IMultiCommitOperationState | null
) {
  if (currentPopup === null || state === null) {
    return false
  }

  if (currentPopup.type !== PopupType.MultiCommitOperation) {
    return false
  }

  if (
    state.step.kind === MultiCommitOperationStepKind.ChooseBranch ||
    state.step.kind === MultiCommitOperationStepKind.WarnForcePush ||
    state.step.kind === MultiCommitOperationStepKind.ShowProgress
  ) {
    return true
  }

  return false
}

function constrain(
  value: IConstrainedValue | number,
  min = -Infinity,
  max = Infinity
): IConstrainedValue {
  return { value: typeof value === 'number' ? value : value.value, min, max }
}
