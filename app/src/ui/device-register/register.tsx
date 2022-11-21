import * as React from 'react'
// import { LinkButton } from '../lib/link-button'
// import { Octicon } from '../octicons'
// import * as OcticonSymbol from '../octicons/octicons.generated'
import { Loading } from '../common/loading'
import { Form } from '../common/form'
import { Button } from '../common/button'
import { TextBox } from '../common/text-box'
import { Errors } from '../common/errors'

/** Text to let the user know their browser will send them back to GH Desktop */
export const BrowserRedirectMessage =
  "Your browser will redirect you back to GitHub Desktop once you've signed in. If your browser asks for your permission to launch GitHub Desktop please allow it to."

interface IRegisterProps {
  /**
   * A callback which is invoked once the user has entered device and hotel info
   * and submitted those either by clicking on the submit
   * button or by submitting the form through other means (ie hitting Enter).
   */
  readonly onSubmit: (hotel: string, deviceName: string, deviceDescription: string) => void

  /**
   * An array of additional buttons to render after the "Register" button.
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
   * A value indicating whether or not the device register store is
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

export class Register extends React.Component<
  IRegisterProps,
  IRegisterState
> {
  public constructor(props: IRegisterProps) {
    super(props)

    this.state = { hotel: '', deviceName: '', deviceDescription: '' }
  }

  public render() {
    const content = this.renderRegisterForm()

    return (
      <Form className="sign-in-form" onSubmit={this.register}>
        {content}
      </Form>
    )
  }

  private renderRegisterForm() {
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
    const registerDisabled = Boolean(
      !this.state.hotel.length ||
        !this.state.deviceName.length ||
        !this.state.deviceDescription.length ||
        this.props.loading
    )
    return (
      <div className="actions">
        <Button type="submit" disabled={registerDisabled}>
          {this.props.loading ? <Loading /> : null} Đăng ký
        </Button>
      </div>
    )
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

  private register = () => {
    this.props.onSubmit(this.state.hotel, this.state.deviceName, this.state.deviceDescription)
  }
}
