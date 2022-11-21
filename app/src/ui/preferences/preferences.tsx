import * as React from 'react'
import { Account } from '../../models/account'
import { PreferencesTab } from '../../models/preferences'
import { Dispatcher } from '../dispatcher'
import { TabBar, TabBarType } from '../tab-bar'
import { Advanced } from './advanced'
import { assertNever } from '../../lib/fatal-error'
import { Dialog, DialogFooter, DialogError } from '../common/dialog'

import { Shell, getAvailableShells } from '../../lib/shells'
import { getAvailableEditors } from '../../lib/editors/lookup'

import { Appearance } from './appearance'
import { ApplicationTheme, ICustomTheme } from '../lib/application-theme'
import { OkCancelButtonGroup } from '../common/dialog/ok-cancel-button-group'
import { Integrations } from './integrations'

import { Octicon } from '../octicons'
import * as OcticonSymbol from '../octicons/octicons.generated'

interface IPreferencesProps {
  readonly dispatcher: Dispatcher
  readonly dotComAccount: Account | null
  readonly enterpriseAccount: Account | null
  readonly onDismissed: () => void
  readonly useWindowsOpenSSH: boolean
  readonly notificationsEnabled: boolean
  readonly optOutOfUsageTracking: boolean
  readonly initialSelectedTab?: PreferencesTab
  readonly selectedExternalEditor: string | null
  readonly selectedShell: Shell
  readonly selectedTheme: ApplicationTheme
  readonly customTheme?: ICustomTheme
}

interface IPreferencesState {
  readonly selectedIndex: PreferencesTab
  
  readonly disallowedCharactersMessage: string | null
  readonly useWindowsOpenSSH: boolean
  readonly notificationsEnabled: boolean
  readonly optOutOfUsageTracking: boolean
  readonly availableEditors: ReadonlyArray<string>
  readonly selectedExternalEditor: string | null
  readonly availableShells: ReadonlyArray<Shell>
  readonly selectedShell: Shell
  /**
   * If unable to save Git configuration values (name, email)
   * due to an existing configuration lock file this property
   * will contain the (fully qualified) path to said lock file
   * such that an error may be presented and the user given a
   * choice to delete the lock file.
   */
  readonly existingLockFilePath?: string
}

/** The app-level preferences component. */
export class Preferences extends React.Component<
  IPreferencesProps,
  IPreferencesState
> {
  public constructor(props: IPreferencesProps) {
    super(props)

    this.state = {
      selectedIndex: this.props.initialSelectedTab || PreferencesTab.Accounts,
      disallowedCharactersMessage: null,
      availableEditors: [],
      useWindowsOpenSSH: false,
      notificationsEnabled: true,
      optOutOfUsageTracking: false,
      selectedExternalEditor: this.props.selectedExternalEditor,
      availableShells: [],
      selectedShell: this.props.selectedShell,
    }
  }

  public async componentWillMount() {
    const [editors, shells] = await Promise.all([
      getAvailableEditors(),
      getAvailableShells(),
    ])

    const availableEditors = editors.map(e => e.editor)
    const availableShells = shells.map(e => e.shell)

    this.setState({
      useWindowsOpenSSH: this.props.useWindowsOpenSSH,
      notificationsEnabled: this.props.notificationsEnabled,
      optOutOfUsageTracking: this.props.optOutOfUsageTracking,
      availableShells,
      availableEditors,
    })
  }

  public render() {
    return (
      <Dialog
        id="preferences"
        title={__DARWIN__ ? 'Preferences' : 'Options'}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSave}
      >
        <div className="preferences-container">
          {this.renderDisallowedCharactersError()}
          <TabBar
            onTabClicked={this.onTabClicked}
            selectedIndex={this.state.selectedIndex}
            type={TabBarType.Vertical}
          >
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.home} />
              Accounts
            </span>
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.person} />
              Integrations
            </span>
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.gitCommit} />
              Git
            </span>
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.paintbrush} />
              Appearance
            </span>
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.question} />
              Prompts
            </span>
            <span>
              <Octicon className="icon" symbol={OcticonSymbol.settings} />
              Advanced
            </span>
          </TabBar>

          {this.renderActiveTab()}
        </div>
        {this.renderFooter()}
      </Dialog>
    )
  }

  private renderDisallowedCharactersError() {
    const message = this.state.disallowedCharactersMessage
    if (message != null) {
      return <DialogError>{message}</DialogError>
    } else {
      return null
    }
  }

  private renderActiveTab() {
    const index = this.state.selectedIndex
    let View
    switch (index) {
      case PreferencesTab.Integrations: {
        View = (
          <Integrations
            availableEditors={this.state.availableEditors}
            selectedExternalEditor={this.state.selectedExternalEditor}
            onSelectedEditorChanged={this.onSelectedEditorChanged}
            availableShells={this.state.availableShells}
            selectedShell={this.state.selectedShell}
            onSelectedShellChanged={this.onSelectedShellChanged}
          />
        )
        break
      }
      case PreferencesTab.Appearance:
        View = (
          <Appearance
            selectedTheme={this.props.selectedTheme}
            customTheme={this.props.customTheme}
            onSelectedThemeChanged={this.onSelectedThemeChanged}
            onCustomThemeChanged={this.onCustomThemeChanged}
          />
        )
        break
      case PreferencesTab.Advanced: {
        View = (
          <Advanced
            useWindowsOpenSSH={this.state.useWindowsOpenSSH}
            notificationsEnabled={this.state.notificationsEnabled}
            optOutOfUsageTracking={this.state.optOutOfUsageTracking}
            onUseWindowsOpenSSHChanged={this.onUseWindowsOpenSSHChanged}
            onNotificationsEnabledChanged={this.onNotificationsEnabledChanged}
            onOptOutofReportingChanged={this.onOptOutofReportingChanged}
          />
        )
        break
      }
      default:
        return assertNever(index as never, `Unknown tab index: ${index}`)
    }

    return <div className="tab-container">{View}</div>
  }

  private onUseWindowsOpenSSHChanged = (useWindowsOpenSSH: boolean) => {
    this.setState({ useWindowsOpenSSH })
  }

  private onNotificationsEnabledChanged = (notificationsEnabled: boolean) => {
    this.setState({ notificationsEnabled })
  }

  private onOptOutofReportingChanged = (value: boolean) => {
    this.setState({ optOutOfUsageTracking: value })
  }

  private onSelectedEditorChanged = (editor: string) => {
    this.setState({ selectedExternalEditor: editor })
  }

  private onSelectedShellChanged = (shell: Shell) => {
    this.setState({ selectedShell: shell })
  }

  private onSelectedThemeChanged = (theme: ApplicationTheme) => {
    this.props.dispatcher.setSelectedTheme(theme)
  }

  private onCustomThemeChanged = (theme: ICustomTheme) => {
    this.props.dispatcher.setCustomTheme(theme)
  }

  private renderFooter() {
    const hasDisabledError = this.state.disallowedCharactersMessage != null

    const index = this.state.selectedIndex
    switch (index) {
      case PreferencesTab.Accounts:
      case PreferencesTab.Appearance:
        return null
      case PreferencesTab.Integrations:
      case PreferencesTab.Advanced:
      case PreferencesTab.Prompts:
      case PreferencesTab.Git: {
        return (
          <DialogFooter>
            <OkCancelButtonGroup
              okButtonText="Save"
              okButtonDisabled={hasDisabledError}
            />
          </DialogFooter>
        )
      }
      default:
        return assertNever(index, `Unknown tab index: ${index}`)
    }
  }

  private onSave = async () => {
    this.props.dispatcher.setUseWindowsOpenSSH(this.state.useWindowsOpenSSH)
    this.props.dispatcher.setNotificationsEnabled(
      this.state.notificationsEnabled
    )

    await this.props.dispatcher.setStatsOptOut(
      this.state.optOutOfUsageTracking,
      false
    )

    await this.props.dispatcher.setShell(this.state.selectedShell)

    this.props.onDismissed()
  }

  private onTabClicked = (index: number) => {
    this.setState({ selectedIndex: index })
  }
}
