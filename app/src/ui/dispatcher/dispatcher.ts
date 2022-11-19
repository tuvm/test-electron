import { Disposable } from 'event-kit'

import {
  Foldout,
  FoldoutType,
  ICompareFormUpdate,
  MultiCommitOperationConflictState,
} from '../../lib/app-state'
import { fatalError } from '../../lib/fatal-error'
import {
  setGenericPassword,
  setGenericUsername,
} from '../../lib/generic-git-auth'
import { isGitOnPath } from '../../lib/is-git-on-path'
import {
  rejectOAuthRequest,
  requestAuthenticatedUser,
  resolveOAuthRequest,
} from '../../lib/oauth'
import {
  URLActionType,
} from '../../lib/parse-app-url'
import { Shell } from '../../lib/shells'
import { ILaunchStats, StatsStore } from '../../lib/stats'
import { AppStore } from '../../lib/stores/app-store'
import { RepositoryStateCache } from '../../lib/stores/repository-state-cache'

import { Account } from '../../models/account'
import { AppMenu, ExecutableMenuItem } from '../../models/app-menu'
import { Branch, IAheadBehind } from '../../models/branch'
import { BranchesTab } from '../../models/branches-tab'
import { CloneRepositoryTab } from '../../models/clone-repository-tab'
import { Commit, CommitOneLine } from '../../models/commit'
import { DiffSelection } from '../../models/diff'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { Popup, PopupType } from '../../models/popup'
import { PullRequest } from '../../models/pull-request'
import {
  Repository,
  RepositoryWithGitHubRepository,
  getGitHubHtmlUrl,
} from '../../models/repository'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
} from '../../models/status'
import { TipState } from '../../models/tip'
import { Banner, BannerType } from '../../models/banner'

import { ApplicationTheme, ICustomTheme } from '../lib/application-theme'
import { installCLI } from '../lib/install-cli'
import {
  executeMenuItem,
  moveToApplicationsFolder,
  isWindowFocused,
} from '../main-process-proxy'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import { sleep } from '../../lib/promise'
import { DragElement } from '../../models/drag-drop'
import { ILastThankYou } from '../../models/last-thank-you'
import {
  MultiCommitOperationDetail,
  MultiCommitOperationKind,
  MultiCommitOperationStep,
  MultiCommitOperationStepKind,
} from '../../models/multi-commit-operation'
import { getMultiCommitOperationChooseBranchStep } from '../../lib/multi-commit-operation'
import { ValidNotificationPullRequestReviewState } from '../../lib/valid-notification-pull-request-review'

/**
 * An error handler function.
 *
 * If the returned {Promise} returns an error, it will be passed to the next
 * error handler. If it returns null, error propagation is halted.
 */
export type ErrorHandler = (
  error: Error,
  dispatcher: Dispatcher
) => Promise<Error | null>

/**
 * The Dispatcher acts as the hub for state. The StateHub if you will. It
 * decouples the consumer of state from where/how it is stored.
 */
export class Dispatcher {
  private readonly errorHandlers = new Array<ErrorHandler>()

  public constructor(
    private readonly appStore: AppStore,
    private readonly repositoryStateManager: RepositoryStateCache,
    private readonly statsStore: StatsStore,
    // private readonly commitStatusStore: CommitStatusStore
  ) {}

  /** Load the initial state for the app. */
  public loadInitialState(): Promise<void> {
    return this.appStore.loadInitialState()
  }

  /** Resume an already started onboarding tutorial */
  public resumeTutorial(repository: Repository) {
    return this.appStore._resumeTutorial(repository)
  }

  /** Suspend the onboarding tutorial and go to the no repositories blank slate view */
  public pauseTutorial(repository: Repository) {
    return this.appStore._pauseTutorial(repository)
  }

  /**
   * Change the selected commit in the history view.
   *
   * @param repository The currently active repository instance
   *
   * @param sha The object id of one of the commits currently
   *            the history list, represented as a SHA-1 hash
   *            digest. This should match exactly that of Commit.Sha
   */
  public changeCommitSelection(
    repository: Repository,
    shas: ReadonlyArray<string>,
    isContiguous: boolean
  ): void {
    return this.appStore._changeCommitSelection(repository, shas, isContiguous)
  }

  /** Update the shas that should be highlighted */
  public updateShasToHighlight(
    repository: Repository,
    shasToHighlight: ReadonlyArray<string>
  ) {
    this.appStore._updateShasToHighlight(repository, shasToHighlight)
  }

  /**
   * Change the selected changed file in the history view.
   *
   * @param repository The currently active repository instance
   *
   * @param file A FileChange instance among those available in
   *            IHistoryState.changedFiles
   */
  public changeFileSelection(
    repository: Repository,
    file: CommittedFileChange
  ): Promise<void> {
    return this.appStore._changeFileSelection(repository, file)
  }

  /** Set the repository filter text. */
  public setRepositoryFilterText(text: string): Promise<void> {
    return this.appStore._setRepositoryFilterText(text)
  }

  /**
   * Changes the selection in the changes view to the stash entry view and
   * optionally selects a particular file from the current stash entry.
   *
   *  @param file  A file to select when showing the stash entry.
   *               If undefined this method will preserve the previously selected
   *               file or pick the first changed file if no selection exists.
   */
  public selectStashedFile(
    repository: Repository,
    file?: CommittedFileChange | null
  ): Promise<void> {
    return this.appStore._selectStashedFile(repository, file)
  }

  /** Change the file's includedness. */
  public changeFileIncluded(
    repository: Repository,
    file: WorkingDirectoryFileChange,
    include: boolean
  ): Promise<void> {
    return this.appStore._changeFileIncluded(repository, file, include)
  }

  /** Change the file's line selection state. */
  public changeFileLineSelection(
    repository: Repository,
    file: WorkingDirectoryFileChange,
    diffSelection: DiffSelection
  ): Promise<void> {
    return this.appStore._changeFileLineSelection(
      repository,
      file,
      diffSelection
    )
  }

  /** Change the Include All state. */
  public changeIncludeAllFiles(
    repository: Repository,
    includeAll: boolean
  ): Promise<void> {
    return this.appStore._changeIncludeAllFiles(repository, includeAll)
  }

  /** Show the popup. This will close any current popup. */
  public showPopup(popup: Popup): Promise<void> {
    return this.appStore._showPopup(popup)
  }

  /**
   * Close the current popup, if found
   *
   * @param popupType only close the popup if it matches this `PopupType`
   */
  public closePopup(popupType?: PopupType) {
    return this.appStore._closePopup(popupType)
  }

  /** Show the foldout. This will close any current popup. */
  public showFoldout(foldout: Foldout): Promise<void> {
    return this.appStore._showFoldout(foldout)
  }
  /** Close the current foldout. If opening a new foldout use closeFoldout instead. */
  public closeCurrentFoldout(): Promise<void> {
    return this.appStore._closeCurrentFoldout()
  }

  /** Close the specified foldout */
  public closeFoldout(foldout: FoldoutType): Promise<void> {
    return this.appStore._closeFoldout(foldout)
  }

  /** Initialize rebase flow to choose branch step **/
  public async showRebaseDialog(
    repository: Repository,
    initialBranch?: Branch | null
  ) {
    const repositoryState = this.repositoryStateManager.get(repository)
    const initialStep = getMultiCommitOperationChooseBranchStep(
      repositoryState,
      initialBranch
    )

    const { tip } = repositoryState.branchesState
    let currentBranch: Branch | null = null

    if (tip.kind === TipState.Valid) {
      currentBranch = tip.branch
    } else {
      throw new Error(
        'Tip is not in a valid state, which is required to start the rebase flow'
      )
    }

    this.initializeMultiCommitOperation(
      repository,
      {
        kind: MultiCommitOperationKind.Rebase,
        sourceBranch: null,
        commits: [],
        currentTip: tip.branch.tip.sha,
      },
      currentBranch,
      [],
      currentBranch.tip.sha
    )

    this.setMultiCommitOperationStep(repository, initialStep)

    this.showPopup({
      type: PopupType.MultiCommitOperation,
      repository,
    })
  }

  /**
   * Show the tag creation dialog.
   */
  public showCreateTagDialog(
    repository: Repository,
    targetCommitSha: string,
    localTags: Map<string, string> | null,
    initialName?: string
  ): Promise<void> {
    return this.showPopup({
      type: PopupType.CreateTag,
      repository,
      targetCommitSha,
      initialName,
      localTags,
    })
  }

  /**
   * Show the confirmation dialog to delete a tag.
   */
  public showDeleteTagDialog(
    repository: Repository,
    tagName: string
  ): Promise<void> {
    return this.showPopup({
      type: PopupType.DeleteTag,
      repository,
      tagName,
    })
  }

  /**
   * Post the given error. This will send the error through the standard error
   * handler machinery.
   */
  public async postError(error: Error): Promise<void> {
    let currentError: Error | null = error
    for (let i = this.errorHandlers.length - 1; i >= 0; i--) {
      const handler = this.errorHandlers[i]
      currentError = await handler(currentError, this)

      if (!currentError) {
        break
      }
    }

    if (currentError) {
      fatalError(
        `Unhandled error ${currentError}. This shouldn't happen! All errors should be handled, even if it's just by the default handler.`
      )
    }
  }

  /**
   * Post the given error. Note that this bypasses the standard error handler
   * machinery. You probably don't want that. See `Dispatcher.postError`
   * instead.
   */
  public presentError(error: Error): Promise<void> {
    return this.appStore._pushError(error)
  }

  /** Clear the given error. */
  public clearError(error: Error): Promise<void> {
    return this.appStore._clearError(error)
  }

  /** Start amending the most recent commit. */
  public async startAmendingRepository(
    repository: Repository,
    commit: Commit,
    isLocalCommit: boolean,
    continueWithForcePush: boolean = false
  ) {
    const repositoryState = this.repositoryStateManager.get(repository)
    const { tip } = repositoryState.branchesState
    const { askForConfirmationOnForcePush } = this.appStore.getState()

    if (
      askForConfirmationOnForcePush &&
      !continueWithForcePush &&
      !isLocalCommit &&
      tip.kind === TipState.Valid
    ) {
      return this.showPopup({
        type: PopupType.WarnForcePush,
        operation: 'Amend',
        onBegin: () => {
          this.startAmendingRepository(repository, commit, isLocalCommit, true)
        },
      })
    }

    this.appStore._setRepositoryCommitToAmend(repository, commit)

    this.statsStore.recordAmendCommitStarted()
  }

  /** Stop amending the most recent commit. */
  public async stopAmendingRepository(repository: Repository) {
    this.appStore._setRepositoryCommitToAmend(repository, null)
  }

  /**
   * Set the width of the repository sidebar to the given
   * value. This affects the changes and history sidebar
   * as well as the first toolbar section which contains
   * repo selection on all platforms and repo selection and
   * app menu on Windows.
   */
  public setSidebarWidth(width: number): Promise<void> {
    return this.appStore._setSidebarWidth(width)
  }

  /**
   * Set the update banner's visibility
   */
  public setUpdateBannerVisibility(isVisible: boolean) {
    return this.appStore._setUpdateBannerVisibility(isVisible)
  }

  /**
   * Set the update show case visibility
   */
  public setUpdateShowCaseVisibility(isVisible: boolean) {
    return this.appStore._setUpdateShowCaseVisibility(isVisible)
  }

  /**
   * Set the banner state for the application
   */
  public setBanner(state: Banner) {
    return this.appStore._setBanner(state)
  }

  /**
   * Close the current banner, if found.
   *
   * @param bannerType only close the banner if it matches this `BannerType`
   */
  public clearBanner(bannerType?: BannerType) {
    return this.appStore._clearBanner(bannerType)
  }

  /**
   * Reset the width of the repository sidebar to its default
   * value. This affects the changes and history sidebar
   * as well as the first toolbar section which contains
   * repo selection on all platforms and repo selection and
   * app menu on Windows.
   */
  public resetSidebarWidth(): Promise<void> {
    return this.appStore._resetSidebarWidth()
  }

  /**
   * Set the width of the commit summary column in the
   * history view to the given value.
   */
  public setCommitSummaryWidth(width: number): Promise<void> {
    return this.appStore._setCommitSummaryWidth(width)
  }

  /**
   * Reset the width of the commit summary column in the
   * history view to its default value.
   */
  public resetCommitSummaryWidth(): Promise<void> {
    return this.appStore._resetCommitSummaryWidth()
  }

  /** End the Welcome flow. */
  // public endWelcomeFlow(): Promise<void> {
  //   return this.appStore._endWelcomeFlow()
  // }

  /** Set the commit message input's focus. */
  public setCommitMessageFocus(focus: boolean) {
    this.appStore._setCommitMessageFocus(focus)
  }

  /** Remove the given account from the app. */
  public removeAccount(account: Account): Promise<void> {
    return this.appStore._removeAccount(account)
  }

  /**
   * Ask the dispatcher to apply a transformation function to the current
   * state of the application menu.
   *
   * Since the dispatcher is asynchronous it's possible for components
   * utilizing the menu state to have an out-of-date view of the state
   * of the app menu which is why they're not allowed to transform it
   * directly.
   *
   * To work around potential race conditions consumers instead pass a
   * delegate which receives the updated application menu and allows
   * them to perform the necessary state transitions. The AppMenu instance
   * is itself immutable but does offer transformation methods and in
   * order for the state to be properly updated the delegate _must_ return
   * the latest transformed instance of the AppMenu.
   */
  public setAppMenuState(update: (appMenu: AppMenu) => AppMenu): Promise<void> {
    return this.appStore._setAppMenuState(update)
  }

  /**
   * Tell the main process to execute (i.e. simulate a click of) the given menu item.
   */
  public executeMenuItem(item: ExecutableMenuItem): Promise<void> {
    executeMenuItem(item)
    return Promise.resolve()
  }

  /**
   * Set whether or not to to add a highlight class to the app menu toolbar icon.
   * Used to highlight the button when the Alt key is pressed.
   *
   * Only applicable on non-macOS platforms.
   */
  public setAccessKeyHighlightState(highlight: boolean): Promise<void> {
    return this.appStore._setAccessKeyHighlightState(highlight)
  }

  /**
   * Update the rebase state to indicate the user has resolved conflicts in the
   * current repository.
   */
  public setConflictsResolved(repository: Repository) {
    return this.appStore._setConflictsResolved(repository)
  }

  /** Record the given launch stats. */
  public recordLaunchStats(stats: ILaunchStats): Promise<void> {
    return this.appStore._recordLaunchStats(stats)
  }

  /** Report any stats if needed. */
  public reportStats(): Promise<void> {
    return this.appStore._reportStats()
  }

  /** Open the URL in a browser */
  public openInBrowser(url: string): Promise<boolean> {
    return this.appStore._openInBrowser(url)
  }

  /** Opens a Git-enabled terminal setting the working directory to the repository path */
  public async openShell(
    path: string,
    ignoreWarning: boolean = false
  ): Promise<void> {
    const gitFound = await isGitOnPath()
    if (gitFound || ignoreWarning) {
      this.appStore._openShell(path)
    } else {
      this.appStore._showPopup({
        type: PopupType.InstallGit,
        path,
      })
    }
  }

  /**
   * Opens a path in the external editor selected by the user.
   */
  public async openInExternalEditor(fullPath: string): Promise<void> {
    return this.appStore._openInExternalEditor(fullPath)
  }

  /** Set whether the user has opted out of stats reporting. */
  public setStatsOptOut(
    optOut: boolean,
    userViewedPrompt: boolean
  ): Promise<void> {
    return this.appStore.setStatsOptOut(optOut, userViewedPrompt)
  }

  /** Moves the app to the /Applications folder on macOS. */
  public moveToApplicationsFolder() {
    return moveToApplicationsFolder()
  }

  /**
   * Show a dialog that helps the user create a fork of
   * their local repo.
   */
  public async showCreateForkDialog(
    repository: RepositoryWithGitHubRepository
  ): Promise<void> {
    await this.appStore._showCreateForkDialog(repository)
  }

  /**
   * Register a new error handler.
   *
   * Error handlers are called in order starting with the most recently
   * registered handler. The error which the returned {Promise} resolves to is
   * passed to the next handler, etc. If the handler's {Promise} resolves to
   * null, error propagation is halted.
   */
  public registerErrorHandler(handler: ErrorHandler): Disposable {
    this.errorHandlers.push(handler)

    return new Disposable(() => {
      const i = this.errorHandlers.indexOf(handler)
      if (i >= 0) {
        this.errorHandlers.splice(i, 1)
      }
    })
  }


  public async setAppFocusState(isFocused: boolean): Promise<void> {
    await this.appStore._setAppFocusState(isFocused)
  }

  public async initializeAppFocusState(): Promise<void> {
    const isFocused = await isWindowFocused()
    this.setAppFocusState(isFocused)
  }

  public async dispatchURLAction(action: URLActionType): Promise<void> {
    switch (action.name) {
      case 'oauth':
        try {
          log.info(`[Dispatcher] requesting authenticated user`)
          const user = await requestAuthenticatedUser(action.code, action.state)
          if (user) {
            resolveOAuthRequest(user)
          } else if (user === null) {
            rejectOAuthRequest(new Error('Unable to fetch authenticated user.'))
          }
        } catch (e) {
          rejectOAuthRequest(e)
        }

        if (__DARWIN__) {
          // workaround for user reports that the application doesn't receive focus
          // after completing the OAuth signin in the browser
          const isFocused = await isWindowFocused()
          if (!isFocused) {
            log.info(
              `refocusing the main window after the OAuth flow is completed`
            )
            window.focus()
          }
        }
        break

      default:
        const unknownAction: any = action
        log.warn(
          `Unknown URL action: ${unknownAction.name
          } - payload: ${JSON.stringify(unknownAction)}`
        )
    }
  }

  /**
   * Sets the user's preference so that moving the app to /Applications is not asked
   */
  public setAskToMoveToApplicationsFolderSetting(
    value: boolean
  ): Promise<void> {
    return this.appStore._setAskToMoveToApplicationsFolderSetting(value)
  }

  /**
   * Sets the user's preference so that confirmation to remove repo is not asked
   */
  public setConfirmRepoRemovalSetting(value: boolean): Promise<void> {
    return this.appStore._setConfirmRepositoryRemovalSetting(value)
  }

  /**
   * Sets the user's preference so that confirmation to discard changes is not asked
   */
  public setConfirmDiscardChangesSetting(value: boolean): Promise<void> {
    return this.appStore._setConfirmDiscardChangesSetting(value)
  }

  /**
   * Sets the user's preference so that confirmation to retry discard changes
   * after failure is not asked
   */
  public setConfirmDiscardChangesPermanentlySetting(
    value: boolean
  ): Promise<void> {
    return this.appStore._setConfirmDiscardChangesPermanentlySetting(value)
  }

  /**
   * Sets the user's preference for handling uncommitted changes when switching branches
   */
  public setUncommittedChangesStrategySetting(
    value: UncommittedChangesStrategy
  ): Promise<void> {
    return this.appStore._setUncommittedChangesStrategySetting(value)
  }

  /**
   * Sets the user's preference for an external program to open repositories in.
   */
  public setExternalEditor(editor: string): Promise<void> {
    return this.appStore._setExternalEditor(editor)
  }

  /**
   * Sets the user's preferred shell.
   */
  public setShell(shell: Shell): Promise<void> {
    return this.appStore._setShell(shell)
  }

  /**
   * Install the CLI tool.
   *
   * This is used only on macOS.
   */
  public async installCLI() {
    try {
      await installCLI()

      this.showPopup({ type: PopupType.CLIInstalled })
    } catch (e) {
      log.error('Error installing CLI', e)

      this.postError(e)
    }
  }

  /** Save the generic git credentials. */
  public async saveGenericGitCredentials(
    hostname: string,
    username: string,
    password: string
  ): Promise<void> {
    log.info(`storing generic credentials for '${hostname}' and '${username}'`)
    setGenericUsername(hostname, username)

    try {
      await setGenericPassword(hostname, username, password)
    } catch (e) {
      log.error(
        `Error saving generic git credentials: ${username}@${hostname}`,
        e
      )

      this.postError(e)
    }
  }

  /** Change the hide whitespace in history diff setting */
  public onHideWhitespaceInHistoryDiffChanged(
    hideWhitespaceInDiff: boolean,
    repository: Repository,
    file: CommittedFileChange | null = null
  ): Promise<void> {
    return this.appStore._setHideWhitespaceInHistoryDiff(
      hideWhitespaceInDiff,
      repository,
      file
    )
  }

  /** Change the side by side diff setting */
  public onShowSideBySideDiffChanged(showSideBySideDiff: boolean) {
    return this.appStore._setShowSideBySideDiff(showSideBySideDiff)
  }

  /** Install the global Git LFS filters. */
  public installGlobalLFSFilters(force: boolean): Promise<void> {
    return this.appStore._installGlobalLFSFilters(force)
  }

  /** Install the LFS filters */
  public installLFSHooks(
    repositories: ReadonlyArray<Repository>
  ): Promise<void> {
    return this.appStore._installLFSHooks(repositories)
  }

  /** Change the selected Clone Repository tab. */
  public changeCloneRepositoriesTab(tab: CloneRepositoryTab): Promise<void> {
    return this.appStore._changeCloneRepositoriesTab(tab)
  }

  /**
   * Request a refresh of the list of repositories that
   * the provided account has explicit permissions to access.
   * See ApiRepositoriesStore for more details.
   */
  public refreshApiRepositories(account: Account) {
    return this.appStore._refreshApiRepositories(account)
  }

  /** Change the selected Branches foldout tab. */
  public changeBranchesTab(tab: BranchesTab): Promise<void> {
    return this.appStore._changeBranchesTab(tab)
  }

  /**
   * Open the Explore page at the GitHub instance of this repository
   */
  public showGitHubExplore(repository: Repository): Promise<void> {
    return this.appStore._showGitHubExplore(repository)
  }

  /**
   * Open the Create Pull Request page on GitHub after verifying ahead/behind.
   *
   * Note that this method will present the user with a dialog in case the
   * current branch in the repository is ahead or behind the remote.
   * The dialog lets the user choose whether get in sync with the remote
   * or open the PR anyway. This is distinct from the
   * openCreatePullRequestInBrowser method which immediately opens the
   * create pull request page without showing a dialog.
   */
  public createPullRequest(repository: Repository): Promise<void> {
    return this.appStore._createPullRequest(repository)
  }

  /**
   * Show the current pull request on github.com
   */
  public showPullRequest(repository: Repository): Promise<void> {
    return this.appStore._showPullRequest(repository)
  }

  /**
   * Open a browser and navigate to the provided pull request
   */
  public async showPullRequestByPR(pr: PullRequest): Promise<void> {
    return this.appStore._showPullRequestByPR(pr)
  }

  /**
   * Immediately open the Create Pull Request page on GitHub.
   *
   * See the createPullRequest method for more details.
   */
  public openCreatePullRequestInBrowser(
    repository: Repository,
    branch: Branch
  ): Promise<void> {
    return this.appStore._openCreatePullRequestInBrowser(repository, branch)
  }

  /** Ignore the existing `upstream` remote. */
  public ignoreExistingUpstreamRemote(repository: Repository): Promise<void> {
    return this.appStore._ignoreExistingUpstreamRemote(repository)
  }

  /** Update the compare form state for the current repository */
  public updateCompareForm<K extends keyof ICompareFormUpdate>(
    repository: Repository,
    newState: Pick<ICompareFormUpdate, K>
  ) {
    return this.appStore._updateCompareForm(repository, newState)
  }

  /**
   *  update the manual resolution method for a file
   */
  public updateManualConflictResolution(
    repository: Repository,
    path: string,
    manualResolution: ManualConflictResolution | null
  ) {
    return this.appStore._updateManualConflictResolution(
      repository,
      path,
      manualResolution
    )
  }

  public setConfirmDiscardStashSetting(value: boolean) {
    return this.appStore._setConfirmDiscardStashSetting(value)
  }

  public setConfirmForcePushSetting(value: boolean) {
    return this.appStore._setConfirmForcePushSetting(value)
  }

  public setConfirmUndoCommitSetting(value: boolean) {
    return this.appStore._setConfirmUndoCommitSetting(value)
  }

  /**
   * Updates the application state to indicate a conflict is in-progress
   * as a result of a pull and increments the relevant metric.
   */
  public mergeConflictDetectedFromPull() {
    return this.statsStore.recordMergeConflictFromPull()
  }

  /**
   * Updates the application state to indicate a conflict is in-progress
   * as a result of a merge and increments the relevant metric.
   */
  public mergeConflictDetectedFromExplicitMerge() {
    return this.statsStore.recordMergeConflictFromExplicitMerge()
  }

  /** Increments the `openSubmoduleFromDiffCount` metric */
  public recordOpenSubmoduleFromDiffCount() {
    return this.statsStore.recordOpenSubmoduleFromDiffCount()
  }

  /**
   * Increments the `mergeIntoCurrentBranchMenuCount` metric
   */
  public recordMenuInitiatedMerge(isSquash: boolean = true) {
    return this.statsStore.recordMenuInitiatedMerge(isSquash)
  }

  /**
   * Increments the `rebaseIntoCurrentBranchMenuCount` metric
   */
  public recordMenuInitiatedRebase() {
    return this.statsStore.recordMenuInitiatedRebase()
  }

  /**
   * Increments the `updateFromDefaultBranchMenuCount` metric
   */
  public recordMenuInitiatedUpdate() {
    return this.statsStore.recordMenuInitiatedUpdate()
  }

  /**
   * Increments the `mergesInitiatedFromComparison` metric
   */
  public recordCompareInitiatedMerge() {
    return this.statsStore.recordCompareInitiatedMerge()
  }

  /**
   * Set the application-wide theme
   */
  public setSelectedTheme(theme: ApplicationTheme) {
    return this.appStore._setSelectedTheme(theme)
  }

  /**
   * Set the custom application-wide theme
   */
  public setCustomTheme(theme: ICustomTheme) {
    return this.appStore._setCustomTheme(theme)
  }

  /**
   * Increments either the `repoWithIndicatorClicked` or
   * the `repoWithoutIndicatorClicked` metric
   */
  public recordRepoClicked(repoHasIndicator: boolean) {
    return this.statsStore.recordRepoClicked(repoHasIndicator)
  }

  /**
   * Increments the `createPullRequestCount` metric
   */
  public recordCreatePullRequest() {
    return this.statsStore.recordCreatePullRequest()
  }

  public recordWelcomeWizardInitiated() {
    return this.statsStore.recordWelcomeWizardInitiated()
  }

  public recordCreateRepository() {
    this.statsStore.recordCreateRepository()
  }

  public recordAddExistingRepository() {
    this.statsStore.recordAddExistingRepository()
  }

  /**
   * Increments the `mergeConflictsDialogDismissalCount` metric
   */
  public recordMergeConflictsDialogDismissal() {
    this.statsStore.recordMergeConflictsDialogDismissal()
  }

  /**
   * Increments the `mergeConflictsDialogReopenedCount` metric
   */
  public recordMergeConflictsDialogReopened() {
    this.statsStore.recordMergeConflictsDialogReopened()
  }

  /**
   * Increments the `anyConflictsLeftOnMergeConflictsDialogDismissalCount` metric
   */
  public recordAnyConflictsLeftOnMergeConflictsDialogDismissal() {
    this.statsStore.recordAnyConflictsLeftOnMergeConflictsDialogDismissal()
  }

  /**
   * Increments the `guidedConflictedMergeCompletionCount` metric
   */
  public recordGuidedConflictedMergeCompletion() {
    this.statsStore.recordGuidedConflictedMergeCompletion()
  }

  /**
   * Increments the `unguidedConflictedMergeCompletionCount` metric
   */
  public recordUnguidedConflictedMergeCompletion() {
    this.statsStore.recordUnguidedConflictedMergeCompletion()
  }

  // TODO: more rebase-related actions

  /**
   * Increments the `rebaseConflictsDialogDismissalCount` metric
   */
  public recordRebaseConflictsDialogDismissal() {
    this.statsStore.recordRebaseConflictsDialogDismissal()
  }

  /**
   * Increments the `rebaseConflictsDialogReopenedCount` metric
   */
  public recordRebaseConflictsDialogReopened() {
    this.statsStore.recordRebaseConflictsDialogReopened()
  }

  /** Increments the `errorWhenSwitchingBranchesWithUncommmittedChanges` metric */
  public recordErrorWhenSwitchingBranchesWithUncommmittedChanges() {
    return this.statsStore.recordErrorWhenSwitchingBranchesWithUncommmittedChanges()
  }

  /**
   * Set the width of the commit summary column in the
   * history view to the given value.
   */
  public setStashedFilesWidth = (width: number): Promise<void> => {
    return this.appStore._setStashedFilesWidth(width)
  }

  /**
   * Reset the width of the commit summary column in the
   * history view to its default value.
   */
  public resetStashedFilesWidth = (): Promise<void> => {
    return this.appStore._resetStashedFilesWidth()
  }

  /** Hide the diff for stashed changes */
  public hideStashedChanges(repository: Repository) {
    return this.appStore._hideStashedChanges(repository)
  }

  /**
   * Increment the number of times the user has opened their external editor
   * from the suggested next steps view
   */
  public recordSuggestedStepOpenInExternalEditor(): Promise<void> {
    return this.statsStore.recordSuggestedStepOpenInExternalEditor()
  }

  /**
   * Increment the number of times the user has opened their repository in
   * Finder/Explorer from the suggested next steps view
   */
  public recordSuggestedStepOpenWorkingDirectory(): Promise<void> {
    return this.statsStore.recordSuggestedStepOpenWorkingDirectory()
  }

  /**
   * Increment the number of times the user has opened their repository on
   * GitHub from the suggested next steps view
   */
  public recordSuggestedStepViewOnGitHub(): Promise<void> {
    return this.statsStore.recordSuggestedStepViewOnGitHub()
  }

  /**
   * Increment the number of times the user has used the publish repository
   * action from the suggested next steps view
   */
  public recordSuggestedStepPublishRepository(): Promise<void> {
    return this.statsStore.recordSuggestedStepPublishRepository()
  }

  /**
   * Increment the number of times the user has used the publish branch
   * action branch from the suggested next steps view
   */
  public recordSuggestedStepPublishBranch(): Promise<void> {
    return this.statsStore.recordSuggestedStepPublishBranch()
  }

  /**
   * Increment the number of times the user has used the Create PR suggestion
   * in the suggested next steps view.
   */
  public recordSuggestedStepCreatePullRequest(): Promise<void> {
    return this.statsStore.recordSuggestedStepCreatePullRequest()
  }

  /**
   * Increment the number of times the user has used the View Stash suggestion
   * in the suggested next steps view.
   */
  public recordSuggestedStepViewStash(): Promise<void> {
    return this.statsStore.recordSuggestedStepViewStash()
  }

  /** Record when the user takes no action on the stash entry */
  public recordNoActionTakenOnStash(): Promise<void> {
    return this.statsStore.recordNoActionTakenOnStash()
  }

  /** Record when the user views the stash entry */
  public recordStashView(): Promise<void> {
    return this.statsStore.recordStashView()
  }

  /** Call when the user opts to skip the pick editor step of the onboarding tutorial */
  public skipPickEditorTutorialStep(repository: Repository) {
    return this.appStore._skipPickEditorTutorialStep(repository)
  }

  /**
   * Call when the user has either created a pull request or opts to
   * skip the create pull request step of the onboarding tutorial
   */
  public markPullRequestTutorialStepAsComplete(repository: Repository) {
    return this.appStore._markPullRequestTutorialStepAsComplete(repository)
  }

  /**
   * Increments the `forksCreated ` metric` indicating that the user has
   * elected to create a fork when presented with a dialog informing
   * them that they don't have write access to the current repository.
   */
  public recordForkCreated() {
    return this.statsStore.recordForkCreated()
  }

  /** Open the issue creation page for a GitHub repository in a browser */
  public async openIssueCreationPage(repository: Repository): Promise<boolean> {
    // Default to creating issue on parent repo
    // See https://github.com/desktop/desktop/issues/9232 for rationale
    const url = getGitHubHtmlUrl(repository)
    if (url !== null) {
      this.statsStore.recordIssueCreationWebpageOpened()
      return this.appStore._openInBrowser(`${url}/issues/new/choose`)
    } else {
      return false
    }
  }

  public setCommitSpellcheckEnabled(commitSpellcheckEnabled: boolean) {
    this.appStore._setCommitSpellcheckEnabled(commitSpellcheckEnabled)
  }

  public setUseWindowsOpenSSH(useWindowsOpenSSH: boolean) {
    this.appStore._setUseWindowsOpenSSH(useWindowsOpenSSH)
  }

  public setNotificationsEnabled(notificationsEnabled: boolean) {
    this.appStore._setNotificationsEnabled(notificationsEnabled)
  }

  public recordDiffOptionsViewed() {
    return this.statsStore.recordDiffOptionsViewed()
  }

  /** Initializes multi commit operation state for cherry pick if it is null */
  public initializeMultiCommitOperationStateCherryPick(
    repository: Repository,
    targetBranch: Branch,
    commits: ReadonlyArray<CommitOneLine>,
    sourceBranch: Branch | null
  ): void {
    if (
      this.repositoryStateManager.get(repository).multiCommitOperationState !==
      null
    ) {
      return
    }

    this.initializeMultiCommitOperation(
      repository,
      {
        kind: MultiCommitOperationKind.CherryPick,
        sourceBranch,
        branchCreated: false,
        commits,
      },
      targetBranch,
      commits,
      sourceBranch?.tip.sha ?? null
    )
  }

  /**
   * Moves multi commit operation step to progress and defers to allow user to
   * see the progress dialog instead of suddenly appearing
   * and disappearing again.
   */
  public async switchMultiCommitOperationToShowProgress(
    repository: Repository
  ) {
    this.setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.ShowProgress,
    })
    await sleep(500)
  }

  /** Method to record cherry pick initiated via the context menu. */
  public recordCherryPickViaContextMenu() {
    this.statsStore.recordCherryPickViaContextMenu()
  }

  /** Method to record an operation started via drag and drop and canceled. */
  public recordDragStartedAndCanceled() {
    this.statsStore.recordDragStartedAndCanceled()
  }

  /** Method to set the drag element */
  public setDragElement(dragElement: DragElement): void {
    this.appStore._setDragElement(dragElement)
  }

  /** Method to clear the drag element */
  public clearDragElement(): void {
    this.appStore._setDragElement(null)
  }

  /** Set the multi commit operation target branch */
  public setMultiCommitOperationTargetBranch(
    repository: Repository,
    targetBranch: Branch
  ): void {
    this.repositoryStateManager.updateMultiCommitOperationState(
      repository,
      () => ({
        targetBranch,
      })
    )
  }

  /** Set cherry-pick branch created state */
  public setCherryPickBranchCreated(
    repository: Repository,
    branchCreated: boolean
  ): void {
    this.appStore._setCherryPickBranchCreated(repository, branchCreated)
  }

  /** Gets a branches ahead behind remote or null if doesn't exist on remote */
  public async getBranchAheadBehind(
    repository: Repository,
    branch: Branch
  ): Promise<IAheadBehind | null> {
    return this.appStore._getBranchAheadBehind(repository, branch)
  }

  /** Set whether thank you is in order for external contributions */
  public setLastThankYou(lastThankYou: ILastThankYou) {
    this.appStore._setLastThankYou(lastThankYou)
  }

  public initializeMultiCommitOperation(
    repository: Repository,
    operationDetail: MultiCommitOperationDetail,
    targetBranch: Branch | null,
    commits: ReadonlyArray<Commit | CommitOneLine>,
    originalBranchTip: string | null
  ) {
    this.appStore._initializeMultiCommitOperation(
      repository,
      operationDetail,
      targetBranch,
      commits,
      originalBranchTip
    )
  }

  /**
   * This method is to update the multi operation state to move it along in
   * steps.
   */
  public setMultiCommitOperationStep(
    repository: Repository,
    step: MultiCommitOperationStep
  ): Promise<void> {
    return this.appStore._setMultiCommitOperationStep(repository, step)
  }

  /** Method to clear multi commit operation state. */
  public endMultiCommitOperation(repository: Repository) {
    this.appStore._endMultiCommitOperation(repository)
  }

  /** Opens conflicts found banner for part of multi commit operation */
  public onConflictsFoundBanner = (
    repository: Repository,
    operationDescription: string | JSX.Element,
    multiCommitOperationConflictState: MultiCommitOperationConflictState
  ) => {
    this.setBanner({
      type: BannerType.ConflictsFound,
      operationDescription,
      onOpenConflictsDialog: async () => {
        const { changesState } =
          this.repositoryStateManager.get(repository)
        const { conflictState } = changesState

        if (conflictState == null) {
          log.error(
            '[onConflictsFoundBanner] App is in invalid state to so conflicts dialog.'
          )
          return
        }

        const { manualResolutions } = conflictState

        this.setMultiCommitOperationStep(repository, {
          kind: MultiCommitOperationStepKind.ShowConflicts,
          conflictState: {
            ...multiCommitOperationConflictState,
            manualResolutions,
          },
        })

        this.showPopup({
          type: PopupType.MultiCommitOperation,
          repository,
        })
      },
    })
  }

  public startMergeBranchOperation(
    repository: Repository,
    isSquash: boolean = false,
    initialBranch?: Branch | null
  ) {
    const { branchesState } = this.repositoryStateManager.get(repository)
    const { defaultBranch, allBranches, recentBranches, tip } = branchesState
    let currentBranch: Branch | null = null

    if (tip.kind === TipState.Valid) {
      currentBranch = tip.branch
    } else {
      throw new Error(
        'Tip is not in a valid state, which is required to start the merge operation'
      )
    }

    this.initializeMergeOperation(repository, isSquash, null)

    this.setMultiCommitOperationStep(repository, {
      kind: MultiCommitOperationStepKind.ChooseBranch,
      defaultBranch,
      currentBranch,
      allBranches,
      recentBranches,
      initialBranch: initialBranch !== null ? initialBranch : undefined,
    })

    this.showPopup({
      type: PopupType.MultiCommitOperation,
      repository,
    })
  }

  /** Records the squash that a squash has been invoked by either drag and drop or context menu */
  public recordSquashInvoked(isInvokedByContextMenu: boolean): void {
    if (isInvokedByContextMenu) {
      this.statsStore.recordSquashViaContextMenuInvoked()
    } else {
      this.statsStore.recordSquashViaDragAndDropInvokedCount()
    }
  }

  public initializeMergeOperation(
    repository: Repository,
    isSquash: boolean,
    sourceBranch: Branch | null
  ) {
    const {
      branchesState: { tip },
    } = this.repositoryStateManager.get(repository)

    let currentBranch: Branch | null = null

    if (tip.kind === TipState.Valid) {
      currentBranch = tip.branch
    } else {
      throw new Error(
        'Tip is not in a valid state, which is required to initialize the merge operation'
      )
    }

    this.initializeMultiCommitOperation(
      repository,
      {
        kind: MultiCommitOperationKind.Merge,
        isSquash,
        sourceBranch,
      },
      currentBranch,
      [],
      currentBranch.tip.sha
    )
  }

  public setShowCIStatusPopover(showCIStatusPopover: boolean) {
    this.appStore._setShowCIStatusPopover(showCIStatusPopover)
    if (showCIStatusPopover) {
      this.statsStore.recordCheckRunsPopoverOpened()
    }
  }

  public _toggleCIStatusPopover() {
    this.appStore._toggleCIStatusPopover()
  }

  public recordCheckViewedOnline() {
    this.statsStore.recordCheckViewedOnline()
  }

  public recordCheckJobStepViewedOnline() {
    this.statsStore.recordCheckJobStepViewedOnline()
  }

  public recordRerunChecks() {
    this.statsStore.recordRerunChecks()
  }

  public recordChecksFailedDialogSwitchToPullRequest() {
    this.statsStore.recordChecksFailedDialogSwitchToPullRequest()
  }

  public recordChecksFailedDialogRerunChecks() {
    this.statsStore.recordChecksFailedDialogRerunChecks()
  }

  public recordPullRequestReviewDialogSwitchToPullRequest(
    reviewType: ValidNotificationPullRequestReviewState
  ) {
    this.statsStore.recordPullRequestReviewDialogSwitchToPullRequest(reviewType)
  }

  /**
   * Set the width of the file list column in the pull request files changed
   */
  public setPullRequestFileListWidth(width: number): Promise<void> {
    return this.appStore._setPullRequestFileListWidth(width)
  }

  /**
   * Reset the width of the file list column in the pull request files changed
   */
  public resetPullRequestFileListWidth(): Promise<void> {
    return this.appStore._resetPullRequestFileListWidth()
  }

  /**
   * Device register actions
   */

  public beginDeviceRegister(): Promise<void> {
    return this.appStore._beginDeviceRegister();
  }

  public registerDevice(
    hotel: string,
    deviceName: string,
    deviceDescription: string
  ): Promise<void> {
    return this.appStore._registerDevice(hotel, deviceName, deviceDescription);
  }

  public verifyCode(code: string): Promise<void> {
    return this.appStore._verifyCode(code);
  }

  public endDeviceRegisterFlow(): Promise<void> {
    return this.appStore._endDeviceRegisterFlow();
  }
}
