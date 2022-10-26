import * as Path from 'path'
import {
  AccountsStore,
  CloningRepositoriesStore,
  GitHubUserStore,
  GitStore,
  IssuesStore,
  SignInStore,
} from '.'
import { Account } from '../../models/account'
import { AppMenu, IMenu } from '../../models/app-menu'
import { IAuthor } from '../../models/author'
import {
  DiffSelection,
  DiffSelectionType,
  DiffType,
  ImageDiffType,
  ITextDiff,
} from '../../models/diff'
import { FetchType } from '../../models/fetch'
import {
  GitHubRepository,
  hasWritePermission,
} from '../../models/github-repository'
import {
  forkPullRequestRemoteName,
  IRemote,
  remoteEquals,
} from '../../models/remote'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
  AppFileStatusKind,
} from '../../models/status'
import { TipState, tipEquals, IValidBranch } from '../../models/tip'
import {
  Progress,
  ICheckoutProgress,
  IFetchProgress,
  IRevertProgress,
  IMultiCommitOperationProgress,
} from '../../models/progress'
import { Popup, PopupType } from '../../models/popup'
import { IGitAccount } from '../../models/git-account'
import { themeChangeMonitor } from '../../ui/lib/theme-change-monitor'
// import { getAppPath } from '../../ui/lib/app-proxy'
import {
  ApplicableTheme,
  ApplicationTheme,
  getCurrentlyAppliedTheme,
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
  getDotComAPIEndpoint,
  IAPIOrganization,
  getEndpointForRepository,
  IAPIFullRepository,
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
import { assertNever, fatalError, forceUnwrap } from '../fatal-error'

import { formatCommitMessage } from '../format-commit-message'
import { getGenericHostname, getGenericUsername } from '../generic-git-auth'
import { getAccountForRepository } from '../get-account-for-repository'
import { inferLastPushForRepository } from '../infer-last-push-for-repository'
import { updateMenuState } from '../menu-update'
import { merge } from '../merge'
import {
  IMatchedGitHubRepository,
  matchGitHubRepository,
  matchExistingRepository,
  urlMatchesRemote,
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
import { BackgroundFetcher } from './helpers/background-fetcher'
// import { readEmoji } from '../read-emoji'
import { GitStoreCache } from './git-store-cache'
import { GitErrorContext } from '../git-error-context'
import {
  setNumber,
  setBoolean,
  getBoolean,
  getNumber,
  getNumberArray,
  setNumberArray,
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
import { ComputedAction } from '../../models/computed-action'
import {
  UncommittedChangesStrategy,
  defaultUncommittedChangesStrategy,
} from '../../models/uncommitted-changes-strategy'
import { IStashEntry, StashedChangesLoadStates } from '../../models/stash-entry'
import { arrayEquals } from '../equality'
import { MenuLabelsEvent } from '../../models/menu-labels'
import { updateRemoteUrl } from './updates/update-remote-url'
import {
  TutorialStep,
  orderedTutorialSteps,
  isValidTutorialStep,
} from '../../models/tutorial-step'
import { OnboardingTutorialAssessor } from './helpers/tutorial-assessor'
import { getUntrackedFiles } from '../status'
import { isBranchPushable } from '../helpers/push-control'
import {
  findAssociatedPullRequest,
  isPullRequestAssociatedWithBranch,
} from '../helpers/pull-request-matching'
import { parseRemote } from '../../lib/remote-parsing'
import { sendNonFatalException } from '../helpers/non-fatal-exception'
import { getDefaultDir } from '../../ui/lib/default-dir'
import { WorkflowPreferences } from '../../models/workflow-preferences'
import { isAttributableEmailFor } from '../email'
import { TrashNameLabel } from '../../ui/lib/context-menu'
import { GitError as DugiteError } from 'dugite'
import {
  ErrorWithMetadata,
  CheckoutError,
  DiscardChangesError,
} from '../error-with-metadata'

import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'
import { getTipSha } from '../tip'

import { UseWindowsOpenSSHKey } from '../ssh/ssh'
import { isConflictsFlow } from '../multi-commit-operation'
import { clamp } from '../clamp'
import { EndpointToken } from '../endpoint-token'
import { IRefCheck } from '../ci-checks/ci-checks'

import * as ipcRenderer from '../ipc-renderer'
import { pathExists } from '../../ui/lib/path-exists'
import { offsetFromNow } from '../offset-from'
import { findContributionTargetDefaultBranch } from '../branch'
import { ValidNotificationPullRequestReview } from '../valid-notification-pull-request-review'

const LastSelectedRepositoryIDKey = 'last-selected-repository-id'

const RecentRepositoriesKey = 'recently-selected-repositories'
/**
 *  maximum number of repositories shown in the "Recent" repositories group
 *  in the repository switcher dropdown
 */
const RecentRepositoriesLength = 3

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

// background fetching should occur hourly when Desktop is active, but this
// lower interval ensures user interactions like switching repositories and
// switching between apps does not result in excessive fetching in the app
const BackgroundFetchMinimumInterval = 30 * 60 * 1000

/**
 * Wait 2 minutes before refreshing repository indicators
 */
const InitialRepositoryIndicatorTimeout = 2 * 60 * 1000

const MaxInvalidFoldersToDisplay = 3

const lastThankYouKey = 'version-and-users-of-last-thank-you'
const customThemeKey = 'custom-theme-key'
export class AppStore extends TypedBaseStore<IAppState> {
  private readonly gitStoreCache: GitStoreCache

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()


  /** The background fetcher for the currently selected repository. */
  private currentBackgroundFetcher: BackgroundFetcher | null = null



  private showWelcomeFlow = false
  private focusCommitMessage = false
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

  private uncommittedChangesStrategy = defaultUncommittedChangesStrategy

  private selectedExternalEditor: string | null = null

  private resolvedExternalEditor: string | null = null

  /** The user's preferred shell. */
  private selectedShell = DefaultShell

  /** The current repository filter text */
  private repositoryFilterText: string = ''

  private currentMergeTreePromise: Promise<void> | null = null

  private selectedTheme = ApplicationTheme.System
  private customTheme?: ICustomTheme
  private currentTheme: ApplicableTheme = ApplicationTheme.Light

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
    private readonly issuesStore: IssuesStore,
    private readonly statsStore: StatsStore,
    private readonly signInStore: SignInStore,
    private readonly accountsStore: AccountsStore,
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
}

function constrain(
  value: IConstrainedValue | number,
  min = -Infinity,
  max = Infinity
): IConstrainedValue {
  return { value: typeof value === 'number' ? value : value.value, min, max }
}
