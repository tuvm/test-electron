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
  IUnknownAction,
  URLActionType,
} from '../../lib/parse-app-url'
import { Shell } from '../../lib/shells'
import { ILaunchStats, StatsStore } from '../../lib/stats'
import { AppStore } from '../../lib/stores/app-store'

import { Account } from '../../models/account'
import { AppMenu, ExecutableMenuItem } from '../../models/app-menu'
import { GitHubRepository } from '../../models/github-repository'
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
import { DragElement } from '../../models/drag-drop'
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
    private readonly statsStore: StatsStore,
  ) {}

  /** Load the initial state for the app. */
  public loadInitialState(): Promise<void> {
    return this.appStore.loadInitialState()
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
   * Clone a missing repository to the previous path, and update it's
   * state in the repository list if the clone completes without error.
   */
  public cloneAgain(url: string, path: string): Promise<void> {
    return this.appStore._cloneAgain(url, path)
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

  /** Update the repository's issues from GitHub. */
  public refreshIssues(repository: GitHubRepository): Promise<void> {
    return this.appStore._refreshIssues(repository)
  }

  /** End the Welcome flow. */
  public endWelcomeFlow(): Promise<void> {
    return this.appStore._endWelcomeFlow()
  }

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
   * Clear any in-flight sign in state and return to the
   * initial (no sign-in) state.
   */
  public resetSignInState(): Promise<void> {
    return this.appStore._resetSignInState()
  }

  /**
   * Initiate a sign in flow for github.com. This will put the store
   * in the Authentication step ready to receive user credentials.
   */
  public beginDotComSignIn(): Promise<void> {
    return this.appStore._beginDotComSignIn()
  }

  /**
   * Initiate a sign in flow for a GitHub Enterprise instance. This will
   * put the store in the EndpointEntry step ready to receive the url
   * to the enterprise instance.
   */
  public beginEnterpriseSignIn(): Promise<void> {
    return this.appStore._beginEnterpriseSignIn()
  }

  /**
   * Attempt to advance from the EndpointEntry step with the given endpoint
   * url. This method must only be called when the store is in the authentication
   * step or an error will be thrown.
   *
   * The provided endpoint url will be validated for syntactic correctness as
   * well as connectivity before the promise resolves. If the endpoint url is
   * invalid or the host can't be reached the promise will be rejected and the
   * sign in state updated with an error to be presented to the user.
   *
   * If validation is successful the store will advance to the authentication
   * step.
   */
  public setSignInEndpoint(url: string): Promise<void> {
    return this.appStore._setSignInEndpoint(url)
  }

  /**
   * Attempt to advance from the authentication step using a username
   * and password. This method must only be called when the store is
   * in the authentication step or an error will be thrown. If the
   * provided credentials are valid the store will either advance to
   * the Success step or to the TwoFactorAuthentication step if the
   * user has enabled two factor authentication.
   *
   * If an error occurs during sign in (such as invalid credentials)
   * the authentication state will be updated with that error so that
   * the responsible component can present it to the user.
   */
  public setSignInCredentials(
    username: string,
    password: string
  ): Promise<void> {
    return this.appStore._setSignInCredentials(username, password)
  }

  /**
   * Initiate an OAuth sign in using the system configured browser.
   * This method must only be called when the store is in the authentication
   * step or an error will be thrown.
   *
   * The promise returned will only resolve once the user has successfully
   * authenticated. If the user terminates the sign-in process by closing
   * their browser before the protocol handler is invoked, by denying the
   * protocol handler to execute or by providing the wrong credentials
   * this promise will never complete.
   */
  public requestBrowserAuthentication(): Promise<void> {
    return this.appStore._requestBrowserAuthentication()
  }

  /**
   * Initiate an OAuth sign in using the system configured browser to GitHub.com.
   *
   * The promise returned will only resolve once the user has successfully
   * authenticated. If the user terminates the sign-in process by closing
   * their browser before the protocol handler is invoked, by denying the
   * protocol handler to execute or by providing the wrong credentials
   * this promise will never complete.
   */
  public async requestBrowserAuthenticationToDotcom(): Promise<void> {
    await this.beginDotComSignIn()
    return this.requestBrowserAuthentication()
  }

  /**
   * Attempt to complete the sign in flow with the given OTP token.\
   * This method must only be called when the store is in the
   * TwoFactorAuthentication step or an error will be thrown.
   *
   * If the provided token is valid the store will advance to
   * the Success step.
   *
   * If an error occurs during sign in (such as invalid credentials)
   * the authentication state will be updated with that error so that
   * the responsible component can present it to the user.
   */
  public setSignInOTP(otp: string): Promise<void> {
    return this.appStore._setSignInOTP(otp)
  }

  /**
   * Launch a sign in dialog for authenticating a user with
   * GitHub.com.
   */
  public async showDotComSignInDialog(): Promise<void> {
    await this.appStore._beginDotComSignIn()
    await this.appStore._showPopup({ type: PopupType.SignIn })
  }

  /**
   * Launch a sign in dialog for authenticating a user with
   * a GitHub Enterprise instance.
   * Optionally, you can provide an endpoint URL.
   */
  public async showEnterpriseSignInDialog(endpoint?: string): Promise<void> {
    await this.appStore._beginEnterpriseSignIn()

    if (endpoint !== undefined) {
      await this.appStore._setSignInEndpoint(endpoint)
    }

    await this.appStore._showPopup({ type: PopupType.SignIn })
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
        const unknownAction: IUnknownAction = action as IUnknownAction
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


  /** Change the side by side diff setting */
  public onShowSideBySideDiffChanged(showSideBySideDiff: boolean) {
    return this.appStore._setShowSideBySideDiff(showSideBySideDiff)
  }

  /** Install the global Git LFS filters. */
  public installGlobalLFSFilters(force: boolean): Promise<void> {
    return this.appStore._installGlobalLFSFilters(force)
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

  /**
   * Increments the `forksCreated ` metric` indicating that the user has
   * elected to create a fork when presented with a dialog informing
   * them that they don't have write access to the current repository.
   */
  public recordForkCreated() {
    return this.statsStore.recordForkCreated()
  }

  /**
   * Create a tutorial repository using the given account. The account
   * determines which host (i.e. GitHub.com or a GHES instance) that
   * the tutorial repository should be created on.
   *
   * @param account The account (and thereby the GitHub host) under
   *                which the repository is to be created created
   */
  public createTutorialRepository(account: Account) {
    return this.appStore._createTutorialRepository(account)
  }

  public setRepositoryIndicatorsEnabled(repositoryIndicatorsEnabled: boolean) {
    this.appStore._setRepositoryIndicatorsEnabled(repositoryIndicatorsEnabled)
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

  /** Method to set the drag element */
  public setDragElement(dragElement: DragElement): void {
    this.appStore._setDragElement(dragElement)
  }

  /** Method to clear the drag element */
  public clearDragElement(): void {
    this.appStore._setDragElement(null)
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

}
