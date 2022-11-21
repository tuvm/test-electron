import { Disposable } from 'event-kit'

import {
  Foldout,
  FoldoutType,
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

import { Account } from '../../models/account'
import { AppMenu, ExecutableMenuItem } from '../../models/app-menu'
import { Popup, PopupType } from '../../models/popup'

import { Banner, BannerType } from '../../models/banner'

import { ApplicationTheme, ICustomTheme } from '../lib/application-theme'
import { installCLI } from '../lib/install-cli'
import {
  executeMenuItem,
  moveToApplicationsFolder,
  isWindowFocused,
} from '../main-process-proxy'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import { ILastThankYou } from '../../models/last-thank-you'
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
    // private readonly repositoryStateManager: RepositoryStateCache,
    private readonly statsStore: StatsStore,
    // private readonly commitStatusStore: CommitStatusStore
  ) {}

  /** Load the initial state for the app. */
  public loadInitialState(): Promise<void> {
    return this.appStore.loadInitialState()
  }

  /** Set the repository filter text. */
  public setRepositoryFilterText(text: string): Promise<void> {
    return this.appStore._setRepositoryFilterText(text)
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

  /** Record the given launch stats. */
  public recordLaunchStats(stats: ILaunchStats): Promise<void> {
    return this.appStore._recordLaunchStats(stats)
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

  /** Change the side by side diff setting */
  public onShowSideBySideDiffChanged(showSideBySideDiff: boolean) {
    return this.appStore._setShowSideBySideDiff(showSideBySideDiff)
  }

  /** Install the global Git LFS filters. */
  // public installGlobalLFSFilters(force: boolean): Promise<void> {
  //   return this.appStore._installGlobalLFSFilters(force)
  // }

  /**
   * Request a refresh of the list of repositories that
   * the provided account has explicit permissions to access.
   * See ApiRepositoriesStore for more details.
   */
  public refreshApiRepositories(account: Account) {
    return this.appStore._refreshApiRepositories(account)
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

  // /** Call when the user opts to skip the pick editor step of the onboarding tutorial */
  // public skipPickEditorTutorialStep(repository: Repository) {
  //   return this.appStore._skipPickEditorTutorialStep(repository)
  // }

  // /**
  //  * Call when the user has either created a pull request or opts to
  //  * skip the create pull request step of the onboarding tutorial
  //  */
  // public markPullRequestTutorialStepAsComplete(repository: Repository) {
  //   return this.appStore._markPullRequestTutorialStepAsComplete(repository)
  // }

  /**
   * Increments the `forksCreated ` metric` indicating that the user has
   * elected to create a fork when presented with a dialog informing
   * them that they don't have write access to the current repository.
   */
  public recordForkCreated() {
    return this.statsStore.recordForkCreated()
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

  /** Method to record cherry pick initiated via the context menu. */
  public recordCherryPickViaContextMenu() {
    this.statsStore.recordCherryPickViaContextMenu()
  }

  /** Method to record an operation started via drag and drop and canceled. */
  public recordDragStartedAndCanceled() {
    this.statsStore.recordDragStartedAndCanceled()
  }

  /** Method to clear the drag element */
  public clearDragElement(): void {
    this.appStore._setDragElement(null)
  }

  /** Set whether thank you is in order for external contributions */
  public setLastThankYou(lastThankYou: ILastThankYou) {
    this.appStore._setLastThankYou(lastThankYou)
  }

  /** Records the squash that a squash has been invoked by either drag and drop or context menu */
  public recordSquashInvoked(isInvokedByContextMenu: boolean): void {
    if (isInvokedByContextMenu) {
      this.statsStore.recordSquashViaContextMenuInvoked()
    } else {
      this.statsStore.recordSquashViaDragAndDropInvokedCount()
    }
  }

  // public initializeMergeOperation(
  //   repository: Repository,
  //   isSquash: boolean,
  //   sourceBranch: Branch | null
  // ) {
  //   const {
  //     branchesState: { tip },
  //   } = this.repositoryStateManager.get(repository)

  //   let currentBranch: Branch | null = null

  //   if (tip.kind === TipState.Valid) {
  //     currentBranch = tip.branch
  //   } else {
  //     throw new Error(
  //       'Tip is not in a valid state, which is required to initialize the merge operation'
  //     )
  //   }

  //   this.initializeMultiCommitOperation(
  //     repository,
  //     {
  //       kind: MultiCommitOperationKind.Merge,
  //       isSquash,
  //       sourceBranch,
  //     },
  //     currentBranch,
  //     [],
  //     currentBranch.tip.sha
  //   )
  // }

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
