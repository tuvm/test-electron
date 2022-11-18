import * as React from 'react'
// import { LinkButton } from '../lib/link-button'
// import { Octicon } from '../octicons'
// import * as OcticonSymbol from '../octicons/octicons.generated'
import { Loading } from '../lib/loading'
import { Form } from '../lib/form'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Errors } from '../lib/errors'

/** Text to let the user know their browser will send them back to GH Desktop */
export const BrowserRedirectMessage =
  "Your browser will redirect you back to GitHub Desktop once you've signed in. If your browser asks for your permission to launch GitHub Desktop please allow it to."

interface IRegisterProps {
  /**
   * A callback which is invoked once the user has entered a username
   * and password and submitted those either by clicking on the submit
   * button or by submitting the form through other means (ie hitting Enter).
   */
  readonly onSubmit: (hotel: string, deviceName: string, deviceDescription: string) => void

  /**
   * An array of additional buttons to render after the "Sign In" button.
   * (Usually, a 'cancel' button)
   */
  readonly additionalButtons?: ReadonlyArray<JSX.Element>

  /**
   * An error which, if present, is presented to the
   * user in close proximity to the actions or input fields
   * related to the current step.
   */
  readonly error?: Error | null

  /**
   * A value indicating whether or not the sign in store is
   * busy processing a request. While this value is true all
   * form inputs and actions save for a cancel action will
   * be disabled.
   */
  readonly loading?: boolean

}

interface IRegisterState {
  readonly hotel: string
  readonly deviceName: string
  readonly deviceDescription: string
}

/** The GitHub authentication component. */
export class Register extends React.Component<
  IRegisterProps,
  IRegisterState
> {
  public constructor(props: IRegisterProps) {
    super(props)

    this.state = { hotel: '', deviceName: '', deviceDescription: '' }
  }

  public render() {
    const content = this.renderSignInForm()
      // : this.renderEndpointRequiresWebFlow()

    return (
      <Form className="sign-in-form" onSubmit={this.signIn}>
        {content}
      </Form>
    )
  }

  private renderUsernamePassword() {
    const disabled = this.props.loading
    return (
      <>
        <TextBox
          label="Khách sạn"
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={true}
          onValueChanged={this.onHotelChange}
        />

        <TextBox
          label="Tên thiết bị"
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={true}
          onValueChanged={this.onDeviceNameChange}
        />

        <TextBox
          label="Mô tả thiết bị"
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={true}
          onValueChanged={this.onDeviceDescriptionChange}
        />

        {this.renderError()}

        <div className="sign-in-footer">{this.renderActions()}</div>
      </>
    )
  }

  private renderActions() {
    const signInDisabled = Boolean(
      !this.state.hotel.length ||
        !this.state.deviceName.length ||
        !this.state.deviceDescription.length ||
        this.props.loading
    )
    return (
      <div className="actions">
        <Button type="submit" disabled={signInDisabled}>
          {this.props.loading ? <Loading /> : null} Đăng ký
        </Button>
      </div>
    )
  }

  /**
   * Show the sign in locally form
   *
   * Also displays an option to sign in with browser for
   * enterprise users (but not for dot com users since
   * they will have already been offered this option
   * earlier in the UI flow).
   */
  private renderSignInForm() {
    return this.renderUsernamePassword()
  }

  private renderError() {
    const error = this.props.error
    if (!error) {
      return null
    }

    return <Errors>{error.message}</Errors>
  }

  private onHotelChange = (hotel: string) => {
    this.setState({ hotel })
  }

  private onDeviceNameChange = (deviceName: string) => {
    this.setState({ deviceName })
  }

  private onDeviceDescriptionChange = (deviceDescription: string) => {
    this.setState({ deviceDescription })
  }

  private signIn = () => {
    this.props.onSubmit(this.state.hotel, this.state.deviceName, this.state.deviceDescription)
  }
}
